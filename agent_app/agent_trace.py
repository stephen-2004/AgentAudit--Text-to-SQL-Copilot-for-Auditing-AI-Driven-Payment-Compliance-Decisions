# -*- coding: utf-8 -*-

"""
A live record of what the agent did, for the chat UI to show while it waits.

A reply takes several seconds because the agent works in rounds: the model
decides on a tool, the tool runs, the model reads the result and decides again.
Before this module the UI saw none of that and showed "Thinking..." for the
whole run. :class:`AgentTrace` folds Strands' stream events into a short list of
steps -- which tool ran, when, for how long, and what came back -- so the UI can
draw them as they happen.

Every step is something the agent actually did. Nothing here guesses at the
model's reasoning, which with tool calls enabled is not available from every
provider anyway; the trace is the tool calls and their results, and the gaps
between them are the model's own time.

Pure: no I/O, and the clock is injectable, so tests feed it hand-built events.
"""

import re
import time
import typing as T
import uuid

#: The AI SDK part type the trace travels as. Every update carries the same
#: ``id``, and the AI SDK replaces a data part with a matching id in place, so
#: the UI always holds exactly one trace per reply, at its latest state.
TRACE_PART_TYPE = "data-trace"

#: Longest error line kept in a step summary. The full text still reaches the
#: model; this is only what fits on one line of the log.
MAX_SUMMARY_CHARS = 120

_SCHEMA_TABLE_LINE = re.compile(r"^\s*Table \w+\(", re.MULTILINE)


def summarize_tool_result(tool: str, text: str) -> tuple[str | None, bool]:
    """
    One short line describing a tool's result, and whether the result is a failure.

    Tools in this app report failure as text rather than raising (see
    ``sql_utils.py``: the caller is a model, and a traceback ends its turn), so a
    status of "success" from Strands is not enough. A result starting with
    ``Error`` is a failure whatever the status says.

    Only the two read tools get a summary. A tool this function does not know
    gets none, which the UI draws as a step with a duration and nothing more.
    """
    text = text.strip()
    if text.startswith("Error"):
        first_line = text.splitlines()[0]
        if len(first_line) > MAX_SUMMARY_CHARS:
            first_line = first_line[: MAX_SUMMARY_CHARS - 1] + "…"
        return first_line, True

    if tool == "execute_sql_query":
        if text == "No result":
            return "0 rows", False
        # A pipe table: one header line, one separator line, then the rows.
        table_lines = [line for line in text.splitlines() if line.lstrip().startswith("|")]
        rows = max(len(table_lines) - 2, 0)
        return f"{rows} row" if rows == 1 else f"{rows} rows", False

    if tool == "get_database_schema":
        tables = len(_SCHEMA_TABLE_LINE.findall(text))
        if tables:
            return f"{tables} table" if tables == 1 else f"{tables} tables", False

    return None, False


class AgentTrace:
    """
    The steps of one reply, built up from the agent's stream events.

    Feed every event to :meth:`observe`; when it returns True, send
    :meth:`to_part` to the browser. Call :meth:`finish` once the run is over.

    Steps come from completed messages only. An assistant message carrying a
    ``toolUse`` opens a step, and the user message carrying the matching
    ``toolResult`` closes it. Both arrive as Strands ``{"message": ...}``
    events, which have been stable across providers -- unlike the partial
    tool-input stream, whose granularity varies by model.
    """

    def __init__(self, clock: T.Callable[[], float] = time.monotonic):
        self.id = str(uuid.uuid4())
        self.status = "running"
        self.steps: list[dict] = []
        self._clock = clock
        self._t0 = clock()
        self._open: dict[str, dict] = {}

    def elapsed(self) -> float:
        """Seconds since the trace started."""
        return self._clock() - self._t0

    def observe(self, event: dict) -> bool:
        """Fold one stream event into the trace. Returns True if a step changed."""
        message = event.get("message") if isinstance(event, dict) else None
        if not isinstance(message, dict):
            return False

        changed = False
        for item in message.get("content", []):
            if not isinstance(item, dict):
                continue
            if "toolUse" in item:
                changed |= self._open_step(item["toolUse"])
            elif "toolResult" in item:
                changed |= self._close_step(item["toolResult"])
        return changed

    def finish(self, status: T.Literal["done", "error"] = "done") -> None:
        """
        Mark the run over.

        A step still open at this point never got its result: the run failed or
        was cut off while the tool was running, so it is closed as an error
        rather than left spinning in the UI forever.
        """
        self.status = status
        for step in self._open.values():
            step["status"] = "error"
            step["ms"] = round((self.elapsed() - step["t"]) * 1000)
        self._open.clear()

    def to_part(self) -> dict:
        """The trace as an AI SDK data part, ready to be sent as one SSE event."""
        return {
            "type": TRACE_PART_TYPE,
            "id": self.id,
            "data": {
                "status": self.status,
                "elapsed": round(self.elapsed(), 2),
                "steps": [dict(step) for step in self.steps],
            },
        }

    def _open_step(self, tool_use: dict) -> bool:
        tool_use_id = tool_use.get("toolUseId")
        if not tool_use_id or tool_use_id in self._open:
            return False

        step = {
            "id": tool_use_id,
            "tool": str(tool_use.get("name", "")),
            "status": "running",
            "t": round(self.elapsed(), 2),
        }
        tool_input = tool_use.get("input")
        sql = tool_input.get("sql") if isinstance(tool_input, dict) else None
        if isinstance(sql, str) and sql.strip():
            # The query is the one input worth showing: it is what an auditor
            # would want to rerun. Other tools' inputs are the agent's own notes.
            step["sql"] = sql.strip()

        self.steps.append(step)
        self._open[tool_use_id] = step
        return True

    def _close_step(self, tool_result: dict) -> bool:
        step = self._open.pop(tool_result.get("toolUseId"), None)
        if step is None:
            return False

        text = "".join(
            part.get("text", "")
            for part in tool_result.get("content", [])
            if isinstance(part, dict)
        )
        summary, failed = summarize_tool_result(step["tool"], text)
        succeeded = tool_result.get("status") == "success" and not failed

        step["status"] = "done" if succeeded else "error"
        step["ms"] = round((self.elapsed() - step["t"]) * 1000)
        if summary:
            step["summary"] = summary
        return True
