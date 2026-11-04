# -*- coding: utf-8 -*-

"""AI Agent mixin for the One class."""

import typing as T
from functools import cached_property

from strands import Agent, tool
from strands.models import BedrockModel

from ..paths import path_enum
from ..constants import LlmProviderEnum

if T.TYPE_CHECKING:  # pragma: no cover
    from .one_00_main import One


def load_strands_model_class(class_name: str, provider: str):
    """
    Import a strands model class, with an actionable error when its SDK is missing.

    Every provider SDK is a core dependency (see ``pyproject.toml``), so reaching
    the error path means the virtualenv is out of step with the lock file rather
    than that something is opt-in. ``strands.models`` lazy-imports each provider,
    so without this wrapper that surfaces as a bare ``ModuleNotFoundError: No
    module named 'anthropic'``, which does not say what to do about it.

    Args:
        class_name: The strands class to import, e.g. ``"AnthropicModel"``.
        provider: The ``LLM_PROVIDER`` value that asked for it.

    Returns:
        The strands model class.

    Raises:
        ImportError: If the provider's SDK is not importable.
    """
    from strands import models

    try:
        return getattr(models, class_name)
    except (AttributeError, ImportError) as e:
        raise ImportError(
            f"LLM_PROVIDER={provider!r} needs a vendor SDK that is not importable, "
            f"even though it is a core dependency. The virtualenv is probably "
            f"stale.\n"
            f"Reinstall with:\n"
            f"    mise run inst-python-deps\n"
            f"Or switch provider with LLM_PROVIDER in .env.defaults."
        ) from e


class AgentMixin:
    """Mixin providing AI agent and tool definitions for database queries."""

    @cached_property
    def bedrock_model(self: "One") -> BedrockModel:  # pragma: no cover - needs AWS
        """Create a BedrockModel instance with configured model ID."""
        return BedrockModel(
            boto_session=self.boto_ses,
            model_id=self.config.model_id,
        )

    @cached_property
    def model(self: "One"):
        """
        Build the model for the provider selected by ``LLM_PROVIDER``.

        Exactly one provider is active per process. The credential check happens
        first so a missing API key fails here, with a readable message, rather
        than as an authentication error on the first user question.
        """
        self.config.validate()
        provider = self.config.llm_provider

        if provider == LlmProviderEnum.BEDROCK.value:
            return self.bedrock_model

        if provider == LlmProviderEnum.ANTHROPIC.value:
            anthropic_model_class = load_strands_model_class("AnthropicModel", provider)
            return anthropic_model_class(
                client_args={"api_key": self.config.anthropic_api_key},
                model_id=self.config.model_id,
                # max_tokens is required by the Anthropic provider, unlike the others.
                max_tokens=self.config.max_tokens,
            )

        if provider == LlmProviderEnum.OPENAI.value:
            # OpenAIResponsesModel targets /v1/responses, NOT /v1/chat/completions.
            # This matters: the reasoning models (gpt-5.x) refuse to combine
            # function tools with reasoning on the chat-completions endpoint --
            #     "Function tools with reasoning_effort are not supported for
            #      <model> in /v1/chat/completions. To use function tools, use
            #      /v1/responses or set reasoning_effort to 'none'."
            # This agent is nothing but tools, so the endpoint is the fix.
            # Setting reasoning_effort='none' would work too, but only for the
            # reasoning models -- the older ones reject the argument outright.
            # Responses is also OpenAI's current primary API, so this keeps
            # working across model generations.
            openai_model_class = load_strands_model_class(
                "OpenAIResponsesModel", provider
            )
            return openai_model_class(
                client_args={"api_key": self.config.openai_api_key},
                model_id=self.config.model_id,
            )

        if provider == LlmProviderEnum.GOOGLE.value:
            gemini_model_class = load_strands_model_class("GeminiModel", provider)
            return gemini_model_class(
                client_args={"api_key": self.config.google_api_key},
                model_id=self.config.model_id,
            )

        raise NotImplementedError(  # pragma: no cover
            f"No model builder for LLM_PROVIDER={provider!r}."
        )

    def new_agent(self: "One", **agent_kwargs) -> Agent:  # pragma: no cover - builds a real Agent
        """
        Build a fresh Agent that shares this process's model and tools.

        The web endpoint calls this once per request, so each conversation gets
        its own message list. Two requests that overlap never touch the same
        Agent: one cannot clear or overwrite the other's history, and Strands
        never sees one Agent invoked twice at once (which it refuses with a
        ``ConcurrencyException``).

        Cheap to call. The model, the system prompt, the database engine and the
        encoded schema are all cached on ``one``; this only assembles them.

        Args:
            **agent_kwargs: Passed straight to ``Agent``, e.g. ``messages`` to
                restore a conversation or ``callback_handler`` to silence it.
        """
        return Agent(
            model=self.model,
            system_prompt=path_enum.path_bi_agent_system_prompt_content,
            tools=self.agent_tools(),
            **agent_kwargs,
        )

    def agent_tools(self: "One") -> list:
        """
        The tools every Agent is built with.

        ``write_debug_report`` is only offered where it can work: see
        ``Config.debug_report_enabled``. The system prompt says to call it only
        when it is available, so leaving it out on Vercel is not a broken promise.
        """
        tools = [
            # Read-only tools
            self.tool_get_database_schema,
            self.tool_execute_sql_query,
        ]
        if self.config.debug_report_enabled:
            tools.append(self.tool_write_debug_report)
        # Write operation tools are dataset specific: when a dataset needs
        # them, add the @tool methods here and register them in this list.
        return tools

    @cached_property
    def agent(self: "One") -> Agent:  # pragma: no cover - builds a real Agent
        """
        One long-lived Agent, for single-user scripts and the debugger.

        The web endpoint does not use this: it serves overlapping requests, so
        it builds its own Agent per request with :meth:`new_agent`.
        """
        return self.new_agent()

    @tool(
        name="get_database_schema",
    )
    def tool_get_database_schema(
        # self: "One",  # keep for IDE type hints, strands @tool doesn't support typed self
        self,  # uncomment this and comment above when running with strands
    ) -> str:
        """
        Retrieve the complete database schema information in LLM-optimized compact format.

        This tool returns the structure of all tables in the business database,
        including:
        - Table names and column definitions
        - Data types (simplified to STR, INT, DEC, TS, DT, etc.)
        - Constraints: Primary Key (*PK), Unique (*UQ), Not Null (*NN), Index (*IDX)
        - Foreign key relationships (*FK->Table.Column)

        Use this tool FIRST to understand the database structure before writing SQL queries.
        The compact format reduces token usage by ~70% compared to verbose SQL DDL.

        Returns:
            A string containing the encoded database schema in compact format.
        """
        return self.database_schema_str

    @tool(
        name="execute_sql_query",
    )
    def tool_execute_sql_query(
        # self: "One",  # keep for IDE type hints, strands @tool doesn't support typed self
        self,  # uncomment this and comment above when running with strands
        sql: str,
    ) -> str:
        """
        Execute a SQL SELECT query and return results as a Markdown table.

        This tool runs the provided SQL query against the business database and
        returns the results formatted as a Markdown table.
        Markdown tables are token-efficient (~24% fewer tokens than JSON) and
        easy for LLMs to parse.

        Args:
            sql: A valid SQL SELECT query string to execute.

        Returns:
            - On success: A Markdown-formatted table with query results
            - If no rows match: "No result"
            - On error: An error message describing what went wrong

        Note:
            Only SELECT queries are supported. Use get_database_schema first to
            understand available tables and columns before constructing queries.
        """
        return self.execute_sql_query(sql=sql)

    @tool(
        name="write_debug_report",
    )
    def tool_write_debug_report(
        self,
        content: str,
    ) -> str:
        """
        Write a debug report documenting the reasoning process and intermediate steps.

        This tool writes a markdown report to tmp/debug_report.md for debugging and
        transparency purposes. Use this to document your reasoning process.

        Args:
            content: The full markdown content to write to the debug report file.
                     Should include sections like:
                     - User Question
                     - Schema Analysis
                     - SQL Queries and Results
                     - Reasoning Steps
                     - Final Answer

        Returns:
            A confirmation message with the file path.
        """
        try:
            path_enum.path_debug_report_md.write_text(content, encoding="utf-8")
        except FileNotFoundError:
            path_enum.dir_tmp.mkdir(parents=True, exist_ok=True)
            path_enum.path_debug_report_md.write_text(content, encoding="utf-8")
        return f"Debug report written to: {path_enum.path_debug_report_md}"
