# -*- coding: utf-8 -*-

"""
FastAPI backend for AI chat powered by Strands Agent.

This module provides the API endpoints that connect the frontend chat UI
to the Strands Agent with write operation capabilities. It implements the
Vercel AI SDK v5 Data Stream Protocol using Server-Sent Events (SSE).

Key components:
- /api/hello: Health check endpoint
- /api/chat: Main chat endpoint that processes messages and returns AI responses
  with both reasoning (thinking) and text content
"""

import os
import sys

# fmt: off
from fastapi import FastAPI, Request, Query
from fastapi.responses import JSONResponse
from strands.handlers.callback_handler import null_callback_handler
from agent_app.vendor.vercel_ai_sdk import RequestBody  # Parses AI SDK request format
from agent_app.utils import debug
from agent_app.ai_sdk_adapter import ai_sdk_streaming_response
from agent_app.ai_sdk_adapter import ai_sdk_traced_response
from agent_app.ai_sdk_adapter import get_last_user_message_text
from agent_app.ai_sdk_adapter import read_request_body
from agent_app.ai_sdk_adapter import request_body_to_agent_history
from agent_app.one.api import one  # Main singleton with agent
from agent_app.agent_response import parse_agent_response
from agent_app.quota import check_quota
from agent_app.quota import increment_usage
from agent_app.quota import QuotaExceededError
# fmt: on

# Add project root to sys.path for module imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

app = FastAPI()

#: Shown when the monthly cap is reached. A constant, not a model call: the
#: whole point is that this path spends nothing.
QUOTA_EXCEEDED_MESSAGE = (
    "This demo runs on a monthly token budget, and it has been used up for this "
    "billing cycle. The chat will start working again when the budget resets at "
    "the beginning of next month. Thanks for trying it out."
)


def quota_client():
    """
    The DynamoDB client the quota calls need, or None when the cap is off.

    Building a boto3 client measured about 2 seconds here, and the endpoint
    needs it twice per question. With the cap off, `check_quota` and
    `increment_usage` both return before touching the client, so building it
    anyway added roughly 4 seconds of pure waiting to every answer.
    """
    return one.dynamodb_client() if one.config.quota_enabled else None


@app.get("/api/hello")
async def hello_world():
    """
    Health check endpoint for testing FastAPI integration.

    Returns a simple JSON response to verify the API is running.
    """
    return JSONResponse(
        content={
            "message": "Hello from FastAPI!",
            "status": "success",
        },
    )


@app.post("/api/chat")
async def handle_chat_data(request: Request, protocol: str = Query("data")):
    """
    Main chat endpoint that processes user messages and returns AI responses.

    This endpoint uses the Strands Agent to process messages and returns
    responses with both reasoning (thinking) and text content using the
    Vercel AI SDK v5 Data Stream Protocol. While the agent works, each tool
    call it makes is streamed as it happens, as one `data-trace` part the UI
    draws as a live step log (see `agent_app/agent_trace.py`).

    The agent has access to database tools for:
    - Querying the database schema
    - Running read-only SQL queries against the business database
    - Writing a debug report of its own reasoning

    Args:
        request: The incoming HTTP request containing chat messages
        protocol: Stream protocol version (default: "data" for AI SDK v5)
    """
    # --- Log incoming request for troubleshooting
    request_body_data = await read_request_body(request=request)

    # --- Parse the incoming request into AI SDK format
    request_body = RequestBody(**request_body_data)

    # --- Extract the last user message ---
    last_user_message = get_last_user_message_text(request_body)

    if not last_user_message:
        return ai_sdk_streaming_response("Error: No message content found in request.")

    # --- Build this request's own agent, holding this conversation's history ---
    # The frontend sends every earlier message in request_body.messages; all but
    # the last one (the current input) become the agent's history.
    #
    # A fresh Agent per request, not one shared Agent: the answer now streams,
    # so the event loop serves other requests while this one runs. With a shared
    # Agent, a second user's request would clear and refill its history under
    # the first user's running answer, and Strands would refuse the overlapping
    # call outright. Each request owning its Agent rules out both, and means no
    # history can leak from one user to the next. The model, prompt, tools and
    # database engine stay shared and cached, so building one is cheap.
    #
    # The default callback handler prints every token to stdout. The stream
    # below is what the UI reads, so that printing is only noise in the log.
    history_messages = request_body_to_agent_history(request_body)
    agent = one.new_agent(
        messages=history_messages,
        callback_handler=null_callback_handler,
    )

    debug(f"[Agent] Loaded {len(history_messages)} history messages")

    # --- Refuse before spending, if this deployment caps its monthly spend ---
    # A no-op when the cap is off, and it swallows its own infrastructure
    # faults, so the only thing that reaches here is an actual refusal.
    try:
        check_quota(quota_client(), one.config)
    except QuotaExceededError as e:
        debug(f"[Quota] blocked: {e}")
        return ai_sdk_streaming_response(QUOTA_EXCEEDED_MESSAGE)

    # Record message count before calling agent (so we only extract new messages)
    msg_count_before = len(agent.messages)

    def complete(agent_result) -> tuple[str, str]:
        """Runs once the agent has finished: meter, parse, return (answer, thinking)."""
        # --- Meter what that cost ---
        # The per-invocation total on the latest AgentInvocation, not
        # metrics.accumulated_usage. With one Agent per request the two agree
        # today, but the per-invocation figure stays right if an Agent is ever
        # reused across requests again (accumulated_usage would then re-count
        # every earlier request).
        metrics = getattr(agent_result, "metrics", None)
        invocations = getattr(metrics, "agent_invocations", None) or []
        usage = invocations[-1].usage if invocations else {}
        increment_usage(
            quota_client(),
            one.config,
            input_tokens=int(usage.get("inputTokens", 0) or 0),
            output_tokens=int(usage.get("outputTokens", 0) or 0),
        )

        # --- Extract thinking and answer from agent response ---
        thinking, answer = parse_agent_response(agent.messages, msg_count_before)

        debug(f"[Agent] Thinking: {len(thinking)} chars")
        debug(f"[Agent] Answer: {len(answer)} chars")

        # An empty answer streams an empty text block, so the UI shows a
        # reasoning block with nothing under it and the turn reads as a hang.
        # Say so instead: a visible non-answer is debuggable, silence is not.
        if not answer:
            answer = (
                "I worked through this but did not produce a final message. "
                "The reasoning above has what I found — ask me to restate it."
            )
            debug("[Agent] Empty answer, sent fallback text")
        return answer, thinking

    # --- Stream the agent's steps as they happen, then the answer ---
    return ai_sdk_traced_response(
        agent.stream_async(last_user_message),
        on_complete=complete,
    )
