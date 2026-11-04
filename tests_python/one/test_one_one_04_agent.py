# -*- coding: utf-8 -*-

"""
Test for the agent's read-only tools.

These call the tool methods directly, the same way the strands agent does at
runtime, but without building a model or an Agent -- so no API key, no network,
no tokens spent. The tools only touch the local SQLite database and the
filesystem, which is what makes that possible.

The write-operation tools are not covered here: they are commented out of the
agent's tool list and target tables that do not exist in this dataset.
"""

import pytest

from agent_app.one.one_00_main import one
from agent_app.paths import path_enum


class TestReadOnlyTools:
    def test_get_database_schema(self):
        """The schema tool returns the encoded schema, including real tables."""
        result = one.tool_get_database_schema()
        assert isinstance(result, str)
        assert "risk_case" in result
        assert "agent_run" in result

    def test_execute_sql_query(self):
        """A valid SELECT comes back as a Markdown table."""
        result = one.tool_execute_sql_query(sql="SELECT COUNT(*) AS n FROM risk_case")
        assert "|" in result  # Markdown table pipes
        assert "n" in result

    def test_execute_sql_query_no_rows(self):
        """A query matching nothing says so instead of returning an empty table."""
        result = one.tool_execute_sql_query(sql="SELECT 1 WHERE 1 = 0")
        assert result == "No result"

    def test_execute_sql_query_accepts_cte(self):
        """A CTE opens with WITH, not SELECT, and must still be allowed."""
        result = one.tool_execute_sql_query(
            sql="WITH d AS (SELECT case_id FROM risk_case) SELECT COUNT(*) AS n FROM d"
        )
        assert "|" in result
        assert "n" in result

    def test_execute_sql_query_rejects_non_select(self):
        """Write statements are refused: this agent is read-only."""
        result = one.tool_execute_sql_query(sql="DROP TABLE risk_case")
        assert "Invalid query" in result

    def test_write_hidden_behind_a_cte_does_not_land(self):
        """
        SQLite accepts ``WITH x AS (...) DELETE FROM ...``, so the opening
        keyword alone cannot decide this. What protects the data is that every
        agent query runs in a transaction that is always rolled back -- so the
        assertion is on the row count, not on an error string.
        """
        before = one.tool_execute_sql_query(sql="SELECT COUNT(*) AS n FROM risk_case")
        one.tool_execute_sql_query(
            sql="WITH d AS (SELECT case_id FROM risk_case) DELETE FROM risk_case"
        )
        after = one.tool_execute_sql_query(sql="SELECT COUNT(*) AS n FROM risk_case")
        assert before == after

    def test_execute_sql_query_reports_bad_sql(self):
        """A broken query returns an error string rather than raising."""
        result = one.tool_execute_sql_query(sql="SELECT * FROM no_such_table")
        assert result.startswith("Error")

    def test_write_debug_report(self):
        """The debug report tool writes the file and returns its path."""
        content = "# Debug Report\n\nHello from the test suite.\n"
        result = one.tool_write_debug_report(content=content)
        assert path_enum.path_debug_report_md.exists()
        assert path_enum.path_debug_report_md.read_text(encoding="utf-8") == content
        assert str(path_enum.path_debug_report_md) in result


if __name__ == "__main__":
    from agent_app.tests import run_cov_test

    run_cov_test(
        __file__,
        "agent_app.one.one_04_agent",
        preview=False,
    )


class TestLoadStrandsModelClass:
    """
    The lookup that turns a provider name into a strands class. No client is
    constructed, so no key and no network -- getattr on an already-imported
    module is the whole function.
    """

    def test_finds_a_shipped_class(self):
        from agent_app.one.one_04_agent import load_strands_model_class

        assert load_strands_model_class("BedrockModel", "bedrock").__name__ == (
            "BedrockModel"
        )

    def test_a_missing_class_names_the_extra_to_install(self):
        """
        The message has to say which extra, or the reader is left guessing which
        of four optional SDKs the failure is about.
        """
        from agent_app.one.one_04_agent import load_strands_model_class

        with pytest.raises(ImportError, match="anthropic"):
            load_strands_model_class("NoSuchModel", "anthropic")


class TestModelDispatch:
    """
    Which provider gets which strands class. Nothing is constructed for real:
    the loader is replaced, so this checks the branch mapping and the arguments
    each provider is handed -- the part that is this repo's code.

    Getting a branch wrong does not raise; it silently talks to the wrong
    vendor with the wrong key.
    """

    class FakeModel:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    @pytest.fixture
    def one_with(self, monkeypatch):
        from agent_app.config import Config
        from agent_app.one import one_04_agent
        from agent_app.one.one_00_main import One

        loaded = {}

        def fake_loader(class_name, provider):
            loaded["class_name"] = class_name
            loaded["provider"] = provider
            return TestModelDispatch.FakeModel

        monkeypatch.setattr(one_04_agent, "load_strands_model_class", fake_loader)

        def build(**config_kwargs):
            instance = One()
            instance.__dict__["config"] = Config(schema_name="acme_widgets", **config_kwargs)
            return instance, loaded

        return build

    def test_anthropic(self, one_with):
        one, loaded = one_with(llm_provider="anthropic", anthropic_api_key="k")
        model = one.model
        assert loaded["class_name"] == "AnthropicModel"
        assert model.kwargs["client_args"] == {"api_key": "k"}
        # Required by this provider and by no other.
        assert "max_tokens" in model.kwargs

    def test_openai_targets_the_responses_endpoint(self, one_with):
        """
        NOT OpenAIModel: the reasoning models refuse to combine function tools
        with reasoning on /v1/chat/completions, and this agent is nothing but
        tools.
        """
        one, loaded = one_with(llm_provider="openai", openai_api_key="k")
        model = one.model
        assert loaded["class_name"] == "OpenAIResponsesModel"
        assert model.kwargs["client_args"] == {"api_key": "k"}
        assert "max_tokens" not in model.kwargs

    def test_google(self, one_with):
        one, loaded = one_with(llm_provider="google", google_api_key="k")
        assert one.model.kwargs["client_args"] == {"api_key": "k"}
        assert loaded["class_name"] == "GeminiModel"

    def test_bedrock_takes_the_session_path(self, one_with, monkeypatch):
        """Bedrock authenticates with a session, so it skips the key branches."""
        one, _ = one_with(llm_provider="bedrock", aws_region="us-east-1")
        sentinel = object()
        monkeypatch.setitem(one.__dict__, "bedrock_model", sentinel)
        assert one.model is sentinel

    def test_a_missing_key_fails_before_any_request(self, one_with):
        """
        validate() runs first so the failure is readable here rather than an
        authentication error on the first user question.
        """
        one, _ = one_with(llm_provider="openai")
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            _ = one.model


class TestAgentTools:
    """Which tools an Agent is built with. No Agent or model is constructed."""

    @staticmethod
    def tool_names(debug_report_enabled: bool) -> list[str]:
        from agent_app.config import Config
        from agent_app.one.one_00_main import One

        instance = One()
        instance.__dict__["config"] = Config(
            schema_name="acme_widgets", debug_report_enabled=debug_report_enabled
        )
        return [t.tool_name for t in instance.agent_tools()]

    def test_local_gets_the_debug_report_tool(self):
        assert self.tool_names(debug_report_enabled=True) == [
            "get_database_schema",
            "execute_sql_query",
            "write_debug_report",
        ]

    def test_deployed_agent_has_no_debug_report_tool(self):
        """Offering it on a read-only filesystem only produces a failed step per answer."""
        assert self.tool_names(debug_report_enabled=False) == [
            "get_database_schema",
            "execute_sql_query",
        ]

    def test_prompt_makes_the_report_conditional(self):
        """Without this the deployed agent would be told to call a tool it does not have."""
        prompt = path_enum.path_bi_agent_system_prompt_content
        assert "If `write_debug_report` is in your tool list" in prompt


class TestWriteDebugReportCreatesTmp:
    def test_missing_tmp_directory_is_created(self, monkeypatch, tmp_path):
        """
        A fresh checkout has no tmp/, and the first thing that writes there is
        this tool. Failing would lose the report the agent just wrote.
        """
        from agent_app.paths import path_enum

        missing = tmp_path / "not-created-yet"
        monkeypatch.setattr(path_enum, "dir_tmp", missing)
        monkeypatch.setattr(path_enum, "path_debug_report_md", missing / "debug_report.md")

        result = one.tool_write_debug_report(content="# Report")
        assert (missing / "debug_report.md").read_text() == "# Report"
        assert "debug_report.md" in result
