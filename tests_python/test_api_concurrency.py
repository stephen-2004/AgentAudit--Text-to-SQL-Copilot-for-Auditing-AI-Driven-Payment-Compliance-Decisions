# -*- coding: utf-8 -*-

"""
Two chat requests that overlap must not share an Agent.

The endpoint streams, so the event loop serves a second request while the
first is still running. These tests drive ``/api/chat`` in-process through
httpx's ASGI transport with a fake Agent, so no model, database or network is
involved. The fake holds every run open until both have started, which only
passes if the two requests really run side by side, each on its own Agent.
"""

import asyncio
import importlib.util
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent

#: How long a run may wait for its twin before the test fails instead of hangs.
OVERLAP_TIMEOUT = 5.0


def load_api_module():
    """Import api/index.py by path: `api/` is a Vercel entry folder, not a package."""
    spec = importlib.util.spec_from_file_location("api_index_under_test", ROOT / "api" / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeResult:
    """Stands in for the AgentResult Strands puts in its last stream event."""

    metrics = None


class FakeAgent:
    """
    Just enough of a Strands Agent for the endpoint.

    ``stream_async`` records the prompt, then waits until ``expected`` runs have
    started before it answers. If requests were served one at a time, the first
    run would wait for a second one that never starts, and the test would time
    out.
    """

    def __init__(self, registry: "FakeAgentRegistry", messages, callback_handler):
        self.registry = registry
        self.messages = list(messages)
        self.history_at_start = [m["content"][0]["text"] for m in messages]
        self.callback_handler = callback_handler

    async def stream_async(self, prompt: str):
        self.registry.started.append(prompt)
        if len(self.registry.started) >= self.registry.expected:
            self.registry.all_started.set()
        await asyncio.wait_for(self.registry.all_started.wait(), OVERLAP_TIMEOUT)

        # What Strands does on a real run: append the turn to this Agent's own list.
        self.messages.append({"role": "user", "content": [{"text": prompt}]})
        self.messages.append(
            {"role": "assistant", "content": [{"text": f"Answer to: {prompt}"}]}
        )
        yield {"result": FakeResult()}


class FakeAgentRegistry:
    """The fake ``one.new_agent``: builds a FakeAgent per call and keeps them all."""

    def __init__(self, expected: int):
        self.expected = expected
        self.started: list[str] = []
        self.all_started = asyncio.Event()
        self.agents: list[FakeAgent] = []

    def new_agent(self, messages=(), callback_handler=None, **_):
        agent = FakeAgent(self, messages=messages, callback_handler=callback_handler)
        self.agents.append(agent)
        return agent


def chat_body(question: str, history: list[tuple[str, str]] = ()) -> dict:
    """An AI SDK v5 request body: earlier (role, text) turns, then the question."""
    turns = list(history) + [("user", question)]
    return {
        "id": "chat",
        "messages": [
            {"id": f"m{i}", "role": role, "parts": [{"type": "text", "text": text}]}
            for i, (role, text) in enumerate(turns)
        ],
        "trigger": "submit-message",
    }


def run_overlapping_requests(monkeypatch, bodies: list[dict]):
    """Post every body at once against the real app; return (registry, response texts)."""
    api_index = load_api_module()
    registry = FakeAgentRegistry(expected=len(bodies))
    monkeypatch.setattr(api_index.one, "new_agent", registry.new_agent, raising=False)
    monkeypatch.setattr(api_index, "check_quota", lambda *a, **k: None)
    monkeypatch.setattr(api_index, "increment_usage", lambda *a, **k: None)
    monkeypatch.setattr(api_index, "quota_client", lambda: None)

    async def go():
        transport = httpx.ASGITransport(app=api_index.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            responses = await asyncio.gather(
                *(client.post("/api/chat", json=body) for body in bodies)
            )
        return [r.text for r in responses]

    texts = asyncio.run(go())
    return registry, texts


def test_overlapping_requests_each_get_their_own_answer(monkeypatch):
    registry, (text_a, text_b) = run_overlapping_requests(
        monkeypatch,
        [chat_body("question A"), chat_body("question B")],
    )

    # Both runs were in flight at the same moment, or the fake would have timed out.
    assert sorted(registry.started) == ["question A", "question B"]
    assert len(registry.agents) == 2
    assert registry.agents[0] is not registry.agents[1]

    assert "Answer to: question A" in text_a
    assert "Answer to: question B" not in text_a
    assert "Answer to: question B" in text_b
    assert "Answer to: question A" not in text_b
    for text in (text_a, text_b):
        assert '"type":"error"' not in text.replace(" ", "")
        assert "data: [DONE]" in text


def test_each_agent_starts_with_only_its_own_history(monkeypatch):
    history_a = [("user", "A asked first"), ("assistant", "A was answered")]
    history_b = [("user", "B asked first"), ("assistant", "B was answered")]

    registry, _ = run_overlapping_requests(
        monkeypatch,
        [chat_body("question A", history_a), chat_body("question B", history_b)],
    )

    by_prompt = {agent.messages[-2]["content"][0]["text"]: agent for agent in registry.agents}
    assert by_prompt["question A"].history_at_start == ["A asked first", "A was answered"]
    assert by_prompt["question B"].history_at_start == ["B asked first", "B was answered"]


def test_the_agent_is_built_silent(monkeypatch):
    """The default Strands handler prints tokens to stdout, which on Vercel is the response."""
    from strands.handlers.callback_handler import null_callback_handler

    registry, _ = run_overlapping_requests(monkeypatch, [chat_body("only question")])

    assert registry.agents[0].callback_handler is null_callback_handler


if __name__ == "__main__":
    from agent_app.tests import run_cov_test

    run_cov_test(
        __file__,
        "agent_app",
        preview=False,
    )
