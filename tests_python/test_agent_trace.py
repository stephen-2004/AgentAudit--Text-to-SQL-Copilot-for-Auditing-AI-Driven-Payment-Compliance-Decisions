# -*- coding: utf-8 -*-

"""
Tests for agent_trace.py and the traced stream in ai_sdk_adapter.py.

Events are hand-built in the shape Strands emits from ``stream_async``: a
completed assistant message carrying ``toolUse``, then a user message carrying
the matching ``toolResult``, then ``{"result": ...}`` at the end. No model and
no database are involved.
"""

import asyncio
import json

from agent_app.agent_trace import AgentTrace, TRACE_PART_TYPE, summarize_tool_result
from agent_app.ai_sdk_adapter import ai_sdk_traced_generator


class FakeClock:
    """A clock the test moves by hand."""

    def __init__(self):
        self.now = 100.0

    def __call__(self) -> float:
        return self.now


def tool_use(tool_use_id: str, name: str, **tool_input) -> dict:
    return {
        "message": {
            "role": "assistant",
            "content": [{"toolUse": {"toolUseId": tool_use_id, "name": name, "input": tool_input}}],
        }
    }


def tool_result(tool_use_id: str, text: str, status: str = "success") -> dict:
    return {
        "message": {
            "role": "user",
            "content": [
                {"toolResult": {"toolUseId": tool_use_id, "status": status, "content": [{"text": text}]}}
            ],
        }
    }


WIDGET_TABLE = "| widget_id | name |\n|---|---|\n| w1 | sprocket |\n| w2 | gear |"


class TestSummarizeToolResult:
    def test_counts_rows_of_a_pipe_table(self):
        assert summarize_tool_result("execute_sql_query", WIDGET_TABLE) == ("2 rows", False)

    def test_one_row_is_singular(self):
        table = "| n |\n|---|\n| 7 |"
        assert summarize_tool_result("execute_sql_query", table) == ("1 row", False)

    def test_no_result_is_zero_rows(self):
        assert summarize_tool_result("execute_sql_query", "No result") == ("0 rows", False)

    def test_error_text_is_a_failure_whatever_the_tool(self):
        summary, failed = summarize_tool_result(
            "execute_sql_query", 'Error executing query: relation "acme_part" does not exist'
        )
        assert failed is True
        assert summary.startswith("Error executing query")

    def test_long_error_is_cut_to_one_line(self):
        summary, _ = summarize_tool_result("execute_sql_query", "Error: " + "x" * 500 + "\nmore")
        assert len(summary) <= 120
        assert "\n" not in summary

    def test_counts_schema_tables(self):
        schema = "Schema acme(\n  Table widget(\n    id:str*PK,\n  )\n  Table part(\n  )\n)"
        assert summarize_tool_result("get_database_schema", schema) == ("2 tables", False)

    def test_unknown_tool_gets_no_summary(self):
        assert summarize_tool_result("write_debug_report", "saved") == (None, False)


class TestAgentTrace:
    def test_tool_use_opens_a_running_step(self):
        clock = FakeClock()
        trace = AgentTrace(clock=clock)
        clock.now += 2.0
        assert trace.observe(tool_use("a1", "execute_sql_query", sql=" SELECT 1 ")) is True

        (step,) = trace.steps
        assert step == {"id": "a1", "tool": "execute_sql_query", "status": "running", "t": 2.0, "sql": "SELECT 1"}

    def test_tool_result_closes_the_step_with_duration_and_summary(self):
        clock = FakeClock()
        trace = AgentTrace(clock=clock)
        trace.observe(tool_use("a1", "execute_sql_query", sql="SELECT * FROM widget"))
        clock.now += 0.25
        assert trace.observe(tool_result("a1", WIDGET_TABLE)) is True

        (step,) = trace.steps
        assert step["status"] == "done"
        assert step["ms"] == 250
        assert step["summary"] == "2 rows"

    def test_error_text_marks_the_step_failed_despite_success_status(self):
        trace = AgentTrace(clock=FakeClock())
        trace.observe(tool_use("a1", "execute_sql_query", sql="SELECT nope"))
        trace.observe(tool_result("a1", "Error executing query: syntax error"))
        assert trace.steps[0]["status"] == "error"

    def test_non_sql_input_is_not_shown(self):
        trace = AgentTrace(clock=FakeClock())
        trace.observe(tool_use("a1", "write_debug_report", content="private notes"))
        assert "sql" not in trace.steps[0]
        assert "content" not in trace.steps[0]

    def test_unrelated_events_change_nothing(self):
        trace = AgentTrace(clock=FakeClock())
        assert trace.observe({"data": "partial text"}) is False
        assert trace.observe({"start_event_loop": True}) is False
        assert trace.observe({"message": {"role": "assistant", "content": [{"text": "hi"}]}}) is False
        assert trace.steps == []

    def test_unmatched_result_is_ignored(self):
        trace = AgentTrace(clock=FakeClock())
        assert trace.observe(tool_result("ghost", "No result")) is False

    def test_repeated_tool_use_is_not_a_second_step(self):
        trace = AgentTrace(clock=FakeClock())
        trace.observe(tool_use("a1", "get_database_schema"))
        assert trace.observe(tool_use("a1", "get_database_schema")) is False
        assert len(trace.steps) == 1

    def test_finish_closes_a_step_left_open(self):
        trace = AgentTrace(clock=FakeClock())
        trace.observe(tool_use("a1", "execute_sql_query", sql="SELECT 1"))
        trace.finish("error")
        assert trace.status == "error"
        assert trace.steps[0]["status"] == "error"
        assert "ms" in trace.steps[0]

    def test_part_keeps_one_id_across_updates(self):
        trace = AgentTrace(clock=FakeClock())
        first = trace.to_part()
        trace.observe(tool_use("a1", "get_database_schema"))
        second = trace.to_part()
        assert first["type"] == second["type"] == TRACE_PART_TYPE
        assert first["id"] == second["id"]
        assert first["data"]["steps"] == []
        assert len(second["data"]["steps"]) == 1

    def test_part_is_a_snapshot(self):
        """A part already sent must not change when the trace moves on."""
        trace = AgentTrace(clock=FakeClock())
        trace.observe(tool_use("a1", "get_database_schema"))
        sent = trace.to_part()
        trace.observe(tool_result("a1", "Table widget(\n)"))
        assert sent["data"]["steps"][0]["status"] == "running"


async def as_stream(events):
    for event in events:
        yield event


def collect(events, on_complete) -> list[dict | str]:
    """Run the traced generator to the end; decode each SSE line."""

    async def run():
        out = []
        async for chunk in ai_sdk_traced_generator(
            as_stream(events), on_complete, trace=AgentTrace(clock=FakeClock())
        ):
            body = chunk.removeprefix("data: ").strip()
            out.append(body if body == "[DONE]" else json.loads(body))
        return out

    return asyncio.run(run())


class TestTracedGenerator:
    def test_sends_trace_updates_then_the_answer(self):
        result = object()
        received = []

        def on_complete(agent_result):
            received.append(agent_result)
            return "Two widgets.", "counted them"

        out = collect(
            [
                {"start_event_loop": True},
                tool_use("a1", "execute_sql_query", sql="SELECT * FROM widget"),
                tool_result("a1", WIDGET_TABLE),
                {"result": result},
            ],
            on_complete,
        )

        types = [c if isinstance(c, str) else c["type"] for c in out]
        # Opening trace, step opened, step closed, final "done" trace, then the answer.
        assert types[:4] == [TRACE_PART_TYPE] * 4
        assert types[4:] == [
            "reasoning-start", "reasoning-delta", "reasoning-end",
            "text-start", "text-delta", "text-end",
            "finish", "[DONE]",
        ]
        assert out[0]["data"]["status"] == "running"
        assert out[3]["data"]["status"] == "done"
        assert out[3]["data"]["steps"][0]["summary"] == "2 rows"
        assert len({c["id"] for c in out[:4]}) == 1
        assert received == [result]
        assert out[8]["delta"] == "Two widgets."

    def test_failure_mid_stream_becomes_an_error_event(self):
        async def broken():
            yield tool_use("a1", "execute_sql_query", sql="SELECT 1")
            raise RuntimeError("model went away")

        async def run():
            out = []
            async for chunk in ai_sdk_traced_generator(
                broken(), lambda r: ("unused", ""), trace=AgentTrace(clock=FakeClock())
            ):
                body = chunk.removeprefix("data: ").strip()
                out.append(body if body == "[DONE]" else json.loads(body))
            return out

        out = asyncio.run(run())
        assert out[-1] == "[DONE]"
        assert out[-2]["type"] == "error"
        assert "model went away" in out[-2]["errorText"]
        final_trace = out[-3]
        assert final_trace["data"]["status"] == "error"
        assert final_trace["data"]["steps"][0]["status"] == "error"
        assert not any(isinstance(c, dict) and c["type"] == "text-start" for c in out)

    def test_failure_in_on_complete_is_also_an_error_event(self):
        def on_complete(_):
            raise ValueError("parse failed")

        out = collect([{"result": None}], on_complete)
        assert out[-2]["type"] == "error"
        assert "parse failed" in out[-2]["errorText"]
