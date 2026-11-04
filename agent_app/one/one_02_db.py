# -*- coding: utf-8 -*-

"""Database mixin for the One class."""

import typing as T
from functools import cached_property

import sqlalchemy as sa

from ..constants import DbTypeEnum
from ..db_schema.api import new_schema_info
from ..db_schema.api import new_database_info
from ..db_schema.api import encode_database_info
from ..sql_utils import execute_sql_query

if T.TYPE_CHECKING:  # pragma: no cover
    from .one_00_main import One


class DbMixin:
    """Mixin providing database connection and query execution capabilities."""

    def _new_postgres_engine(self: "One", schema_name: str | None = None) -> sa.Engine:
        """
        Open the shared PostgreSQL instance, optionally scoped to one schema.

        When ``schema_name`` is given, every transaction pins ``search_path`` to
        it, which is what lets the agent write ``SELECT ... FROM widget`` and
        have it resolve without ever naming the schema.

        ``None`` leaves the server default -- what the sync needs while it is
        still creating that schema.
        """
        url = sa.URL.create(
            drivername="postgresql+psycopg2",
            username=self.config.db_user,
            password=self.config.db_pass,
            host=self.config.db_host,
            port=self.config.db_port,
            database=self.config.db_name,
        )
        engine = sa.create_engine(url)

        if schema_name:
            # Three ways to pin `search_path`, and only the third one holds.
            #
            # The libpq start-up option (`options=-csearch_path=...`) is the
            # obvious one. A pooled endpoint rejects the *connection*, not the
            # query: Neon's `-pooler` host, and PgBouncer generally, answer with
            # "unsupported startup parameter in options: search_path". It fails
            # inside the driver before anything runs, so it surfaces as the app
            # being unable to reach the database at all.
            #
            # A plain `SET search_path` on the `connect` event is what people try
            # next. It appears to work and is not safe: under transaction pooling
            # the proxy hands out a server connection per *transaction*, so the
            # connection the SET ran on need not be the one a later query gets.
            # That failure looks like a table that exists going missing on load.
            #
            # `SET LOCAL` inside the transaction survives both, because the
            # transaction is the unit the proxy already keeps on one server
            # connection. SQLAlchemy opens one implicitly on first execute, so
            # schema reflection and the agent's SQL tool both get it for free.
            quoted_schema = schema_name.replace('"', '""')

            @sa.event.listens_for(engine, "begin")
            def _pin_search_path(connection):
                connection.exec_driver_sql(
                    f'SET LOCAL search_path TO "{quoted_schema}"'
                )

        return engine

    @cached_property
    def remote_postgres_engine(self: "One") -> sa.Engine:
        """
        The shared PostgreSQL instance, unscoped.

        For work that has to reach across schemas -- creating this project's
        schema, inspecting what exists. The agent never uses this one.
        """
        return self._new_postgres_engine()

    @cached_property
    def engine(self: "One") -> sa.Engine:
        """
        The engine everything is served from: our schema in the shared database.

        **The same database in every environment, laptop included.** It used to
        follow the runtime, which meant one prompt and two dialects: SQL examples
        written against SQLite shipped to PostgreSQL, where ``JULIANDAY`` and
        ``strftime`` do not exist. Nothing failed loudly, because the SQL tool
        hands database errors back to the model as text -- the symptom was worse
        answers. The cost of the fix is that local development needs the ``DB_*``
        variables and a completed sync.
        """
        return self._new_postgres_engine(schema_name=self.config.schema_name)

    @cached_property
    def database_schema_str(self: "One") -> str:
        """
        The database schema, encoded in the compact format the agent reads.

        Scoped to this project's schema, so the agent never sees another
        project's tables in the shared instance.

        An absent schema and an empty one look identical to the reflector, so an
        unsynced database would otherwise hand the agent no tables at all -- it
        would invent plausible ones and answer confidently out of thin air.
        """
        # The schema goes on the MetaData, not only on reflect(): the encoder
        # labels the block with `metadata.schema`, and without it the agent is
        # told it is looking at a schema called "default".
        metadata = sa.MetaData(schema=self.config.schema_name)
        metadata.reflect(bind=self.engine, schema=self.config.schema_name)
        schema_info = new_schema_info(
            engine=self.engine,
            metadata=metadata,
            schema_name=self.config.schema_name,
        )
        database_info = new_database_info(
            # Labelled with the schema name: there is one schema, and a
            # second hand-written name for it was one more thing to keep
            # in step for no reader.
            name=self.config.schema_name,
            db_type=DbTypeEnum.POSTGRESQL,
            schemas=[
                schema_info,
            ],
        )
        if not schema_info.tables:  # pragma: no cover - needs an unsynced schema
            raise RuntimeError(
                f"PostgreSQL schema {self.config.schema_name!r} has no tables. "
                f"An absent schema and an empty one look identical to the "
                f"reflector, so this is almost certainly a database that was "
                f"never loaded. Load the dataset into this schema before "
                f"starting the agent."
            )
        return encode_database_info(database_info=database_info)

    def execute_sql_query(self: "One", sql: str) -> str:
        """Execute a SELECT query and return results as a Markdown table."""
        return execute_sql_query(
            engine=self.engine,
            sql=sql,
        )
