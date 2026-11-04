# AgentAudit

An AI agent that audits another AI agent — the compliance agent a payments-risk platform uses to auto-close suspicious-transaction cases.

Live demo: <to be added>

## Background

AgentAudit is a portfolio rebuild of a proof-of-concept I built with the engineering team during my internship and delivered to a client. The client's data and business details are confidential, so the company in this repo (Solace Risk Systems) and every record are synthetic, generated to reproduce the same kinds of audit problems.

## What it does

Solace's compliance agent closes suspicious-transaction cases on its own, and its dashboard says it is doing well. AgentAudit is a second agent that checks that claim. You ask a question in plain English; it writes SQL against the platform's decision records, runs it, and explains what the numbers show.

## Four audit threads

Each thread comes with a finding you can reproduce from the data:

| Thread | Finding |
| :--- | :--- |
| **Audited Accuracy** | The dashboard reports 98.4% accuracy, yet the audited overturn rate is 7.8%, a 6.2 pp gap. |
| **Human Checkpoint Coverage** | 316 transactions above $10,000 skipped human review and were self-marked as reviewed, about $4.12M in total. |
| **Release Drift** | Audited error rose from 5.4% to 10.1% across releases while self-reported accuracy stayed flat. The two newest releases have no audit samples. |
| **Review Capacity** | Review load averaged about 75%, so capacity does not explain the rise in auto-closes. |

## Engineering highlights

- **Read-only by construction.** The SQL tool runs every query inside a transaction that is always rolled back, so a query cannot change the database. The guarantee comes from the rollback, not from a keyword blacklist.
- **Live trace.** Every tool call the agent makes is streamed to the UI step by step while it answers, so you can follow how an answer was reached.
- **One agent per request.** Each request gets its own agent instance, so multiple users can chat at the same time without sharing history.
- **Tested.** 256 automated tests: 248 run fully offline, and 8 integration tests run against live Postgres, including the read-only guarantee.

## Stack

- **Frontend:** Next.js
- **Backend:** FastAPI
- **Hosting:** Vercel, for both
- **Agent:** Strands Agents SDK + OpenAI
- **Database:** Neon Postgres
- **Data:** 16 tables, 195,026 rows of synthetic data with planted audit findings

## Run locally

You need [mise](https://mise.jdx.dev/), which installs the pinned Python, Node.js, uv and pnpm, and a Postgres database with the AgentAudit data already loaded.

The data lives in a Postgres database that has already been loaded. The generator that produced it is not included in this repository.

Install the toolchain and dependencies:

```bash
mise install
mise run inst
```

Create your `.env` from the template:

```bash
cp .env.example .env
```

Then fill in `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` and `OPENAI_API_KEY`. `.env` is gitignored. Non-secret settings live in the committed `.env.defaults`, including `SCHEMA_NAME`, the Postgres schema the agent reads its tables from.

Check that the database is reachable:

```bash
mise run cli-test-db-conn
```

Start the frontend (port 3000) and backend (port 8000) together:

```bash
mise run dev
```

Open <http://localhost:3000>. Stop the servers with `mise run kill`.
