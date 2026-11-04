# -*- coding: utf-8 -*-

"""
The application's command line: ``agent-app <command>``.

Installed as a console script by ``pyproject.toml``, so ``mise.toml`` names a
command rather than a file path. That indirection is the point: where a check
happens to live can change without every task, doc, and habit changing with it.

**Only application commands belong here.** Building the dataset and loading it
into PostgreSQL happen outside this repository; this CLI only reads a database
that is already loaded.

Argument parsing only; the work lives in the module each command calls. The
parsing itself is ``fire``, which derives the interface from :class:`Cli` --
one public method is one subcommand, and its signature is that subcommand's
options. Adding a command is adding a method, with no parser wiring to keep in
step with it.

``fire`` accepts either spelling of a method name, so ``check-content`` and
``check_content`` both work; the hyphenated one is what the docs and tasks use.

    agent-app check-content
    agent-app check-content --retired "patient,bed,ward"
    agent-app test-db-conn
    agent-app print-db-schema
"""

import typing as T

import fire


def _as_word_list(value: T.Any) -> list[str]:
    """
    Normalize whatever ``fire`` handed us into a list of non-empty words.

    ``--retired "a,b"`` arrives as a tuple because fire parses comma-separated
    values for us, but ``--retired a`` arrives as a plain string and
    ``--retired ""`` as an empty one. Accepting all three keeps the flag's
    behaviour independent of how many words happen to be in it.
    """
    if not value:
        return []
    if isinstance(value, str):
        value = value.split(",")
    return [str(word).strip() for word in value if str(word).strip()]


class Cli:
    """
    Application commands. One public method is one subcommand.

    Every command exits through :class:`SystemExit` rather than returning a
    code, because fire prints a returned value and then exits 0 -- which would
    turn a failed check into a green build with the number 1 on stdout.
    """

    def check_content(self, retired: T.Any = "") -> None:
        """
        Verify data/ still agrees with the prompt, the seed, and itself.

        :param retired: Vocabulary from the dataset this repo used to serve,
            comma-separated. Pass it right after a swap to prove none of it
            survives, e.g. ``--retired "patient,bed,ward"``. Empty by default.
        """
        from agent_app.content_check import run

        raise SystemExit(run(retired=_as_word_list(retired)))

    def test_db_conn(self) -> None:
        """
        Prove this machine can reach the cloud PostgreSQL, and nothing else.

        The smallest possible round trip: connect, ``SELECT 1``, disconnect. It
        touches no schema and no table on purpose -- when the agent is not
        working, this separates a credential or network problem from an unsynced
        or empty schema, which are the two failures that otherwise look alike.
        """
        import sqlalchemy as sa

        from agent_app.api import one

        host = one.config.db_host
        print(f"Connecting to {host} ...")
        try:
            with one.remote_postgres_engine.connect() as conn:
                value = conn.execute(sa.text("SELECT 1;")).scalar_one()
        except Exception as e:
            print(f"FAILED: {type(e).__name__}: {e}")
            print(
                "\nCheck the DB_ variables in .env. They are secrets, so they "
                "are not in .env.defaults -- see .env.example for the full list."
            )
            raise SystemExit(1)

        print(f"OK: the database answered {value}.")
        print(
            "This proves credentials and network only. Whether this project's "
            "schema holds any rows is a separate question -- "
            "`agent-app print-db-schema` answers it."
        )
        raise SystemExit(0)

    def print_db_schema(self) -> None:
        """
        Print the database schema exactly as the agent is shown it.

        Not a dump of the database: it is the compact encoding the agent reads
        as its entire picture of the tables, so this is the one way to see what
        the model actually knows before it writes a line of SQL. Reads this
        project's schema only, and needs a synced one -- an empty schema raises
        rather than printing nothing, because nothing is what an unsynced
        database and a broken encoder both look like.
        """
        from agent_app.api import one

        print(one.database_schema_str)
        raise SystemExit(0)


def main() -> None:
    fire.Fire(Cli, name="agent-app")


if __name__ == "__main__":
    main()
