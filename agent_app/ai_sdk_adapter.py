# -*- coding: utf-8 -*-

"""
Translation layer between the Vercel AI SDK frontend and the Strands Agent.

The only place that knows both dialects: the frontend's typed message *parts*
going in, the AI SDK v5 Data Stream Protocol going out.

**Nothing here is provider-specific, and it must stay that way.** The message
shape the agent uses is the one AWS invented for Bedrock Converse, and Strands
kept it across every provider, so switching ``LLM_PROVIDER`` does not touch this
file. Provider-specific code belongs next to the model construction in
``one_04_agent.py``.

The request data model itself is vendored in ``vendor/vercel_ai_sdk.py``.
"""

import sys
import json
import uuid
import typing as T

from fastapi import Request
from fastapi.responses import StreamingResponse

from .agent_trace import AgentTrace
from .utils import debug
from .vendor.vercel_ai_sdk import RequestBody


# ------------------------------------------------------------------------------
# Inbound: frontend JSON -> agent input
# ------------------------------------------------------------------------------
def get_last_user_message_text(request_body: RequestBody) -> str | None:
    """
    The text of the newest user message -- the question to answer now.

    Returns None rather than raising on an empty request: that is a client bug,
    and the useful response to it is a message, not a stack trace.
    """
    if not request_body.messages:
        return None

    # Only the visible-text parts, so a reasoning block is never mistaken for
    # what the user said.
    text = "".join(part.text for part in request_body.messages[-1].text_parts())
    return text or None


def request_body_to_agent_history(request_body: RequestBody) -> list[dict]:
    """
    Convert the conversation so far into the agent's message format.

    The last message is excluded: that is the question being asked now, which
    goes to the agent as input rather than as history.

    Reasoning parts are dropped -- the agent gains nothing from re-reading its
    own thinking, and those blocks would be resent, and paid for, every turn.
    A message left with no text is skipped, since providers reject empty content.
    """
    messages = []

    for message in request_body.messages[:-1]:
        content = [{"text": part.text} for part in message.text_parts()]
        if content:
            messages.append({"role": message.role, "content": content})

    return messages


# ------------------------------------------------------------------------------
# Outbound: agent output -> AI SDK Data Stream Protocol (SSE)
# ------------------------------------------------------------------------------

#: Required by the AI SDK to parse the body as a v5 message stream, plus the two
#: that stop a proxy or browser from buffering it. Part of the protocol, so they
#: travel with the generator rather than being spelled out at each call site.
#:
#: ``no-transform`` is what keeps the step log live. Without it the Next.js dev
#: proxy gzips the stream, and gzip holds every event until the reply is over,
#: so the browser received the whole trace at once at the end.
SSE_HEADERS = {
    "x-vercel-ai-ui-message-stream": "v1",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
}


def _sse(**payload) -> str:
    """Format one Server-Sent Event line from a JSON payload."""
    return f"data: {json.dumps(payload)}\n\n"


def ai_sdk_message_with_reasoning_generator(
    reasoning_text: str,
    output_text: str,
) -> T.Iterator[str]:
    """
    Stream a finished answer, with its thinking, as AI SDK v5 SSE events.

    Each block is start / delta / end so the UI can open, fill and close it, and
    carries an id so concurrent blocks can be told apart. One delta holds the
    whole string because the agent has already finished; real token streaming
    would emit many deltas and change nothing else.

    An empty ``reasoning_text`` skips those events entirely -- an empty block
    renders as a toggle with nothing inside it.
    """
    if reasoning_text:
        reasoning_id = str(uuid.uuid4())
        yield _sse(type="reasoning-start", id=reasoning_id)
        yield _sse(type="reasoning-delta", id=reasoning_id, delta=reasoning_text)
        yield _sse(type="reasoning-end", id=reasoning_id)

    text_id = str(uuid.uuid4())
    yield _sse(type="text-start", id=text_id)
    yield _sse(type="text-delta", id=text_id, delta=output_text)
    yield _sse(type="text-end", id=text_id)

    # Without this the UI keeps showing a spinner forever.
    yield _sse(type="finish", finishReason="stop")

    # Stream termination marker, defined by the protocol rather than by us.
    yield "data: [DONE]\n\n"


def ai_sdk_streaming_response(
    output_text: str,
    reasoning_text: str = "",
) -> StreamingResponse:
    """
    A ready-to-return SSE response carrying one finished answer.

    Every reply the API sends -- the answer, a refusal, an error -- is this
    shape, so the headers live here instead of being rebuilt at each call site.
    """
    response = StreamingResponse(
        ai_sdk_message_with_reasoning_generator(
            reasoning_text=reasoning_text,
            output_text=output_text,
        ),
        media_type="text/event-stream",
    )
    response.headers.update(SSE_HEADERS)
    return response


async def ai_sdk_traced_generator(
    events: T.AsyncIterator[dict],
    on_complete: T.Callable[[T.Any], tuple[str, str]],
    trace: AgentTrace | None = None,
) -> T.AsyncIterator[str]:
    """
    Stream the agent's steps live, then its finished answer.

    ``events`` is the agent's own stream (``agent.stream_async``). Each event
    that changes a step re-sends the whole trace under one id, which the AI SDK
    applies in place. When the stream ends, ``on_complete`` receives the agent's
    final result and returns ``(output_text, reasoning_text)``, which go out
    exactly as :func:`ai_sdk_message_with_reasoning_generator` always sent them.

    **The answer is deliberately not streamed token by token.** Which message is
    the answer is only known once the run is over (see ``agent_response.py``),
    and the chart and flowchart fences are rewritten after that. Streaming raw
    tokens would skip both and break the rendering contract quietly.

    A failure after the response has started cannot become an HTTP 500 any
    more, so it is sent as the protocol's ``error`` event instead. The UI raises
    that through the same ``onError`` path a 500 used to reach.
    """
    trace = trace or AgentTrace()
    # Sent before the first model call returns, so the reply opens at once
    # rather than after the first tool is chosen.
    yield _sse(**trace.to_part())

    result = None
    try:
        async for event in events:
            if isinstance(event, dict) and "result" in event:
                result = event["result"]
            if trace.observe(event):
                yield _sse(**trace.to_part())
        output_text, reasoning_text = on_complete(result)
    except Exception as e:  # noqa: BLE001 - every failure must close the stream
        debug(f"[Agent] Stream failed: {type(e).__name__}: {e}")
        trace.finish("error")
        yield _sse(**trace.to_part())
        yield _sse(type="error", errorText=f"{type(e).__name__}: {e}")
        yield "data: [DONE]\n\n"
        return

    trace.finish("done")
    yield _sse(**trace.to_part())
    for chunk in ai_sdk_message_with_reasoning_generator(
        reasoning_text=reasoning_text,
        output_text=output_text,
    ):
        yield chunk


def ai_sdk_traced_response(
    events: T.AsyncIterator[dict],
    on_complete: T.Callable[[T.Any], tuple[str, str]],
) -> StreamingResponse:
    """A ready-to-return SSE response for one live agent run. See :func:`ai_sdk_traced_generator`."""
    response = StreamingResponse(
        ai_sdk_traced_generator(events=events, on_complete=on_complete),
        media_type="text/event-stream",
    )
    response.headers.update(SSE_HEADERS)
    return response


# ------------------------------------------------------------------------------
# Request logging
# ------------------------------------------------------------------------------

#: Headers replaced with a placeholder before logging. These logs are retained
#: by the host, so anything that authenticates a caller must not reach them.
SENSITIVE_HEADERS = frozenset(
    {"authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"}
)

REDACTED = "<redacted>"


async def read_request_body(request: Request) -> dict:
    """
    Read the JSON body, logging the request on the way through.

    Logs *and* returns because a request body can only be read once: reading it
    here and throwing it away would leave the caller with nothing to parse.
    """
    debug("====== Incoming request")
    debug("------ Request Headers")
    for key, value in request.headers.items():
        shown = REDACTED if key.lower() in SENSITIVE_HEADERS else value
        debug(f"{key}: {shown}")
    debug("------ Request Body")
    request_body_data = await request.json()
    debug(json.dumps(request_body_data, indent=2, ensure_ascii=False))
    sys.stderr.flush()
    return request_body_data
