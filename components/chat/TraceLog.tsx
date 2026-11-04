"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The agent's steps for one reply, drawn as a log while it works.
 *
 * Fed by the `data-trace` part the backend re-sends whenever a step changes
 * (`agent_app/agent_trace.py`); the AI SDK replaces the part in place, so this
 * always renders the latest state. Every row is a tool call that actually ran.
 * The live "thinking" row at the bottom is the model's own time between them,
 * which is the one thing here that is inferred: it is shown only while the run
 * is open and no tool is running.
 *
 * Open while the run is in progress, folded to one summary line when it ends,
 * so a long conversation does not keep every log expanded. A reader can open
 * or fold it at any time; their choice then sticks.
 */

export interface TraceStep {
  id: string
  tool: string
  status: "running" | "done" | "error"
  /** Seconds from the start of the run. */
  t: number
  /** Tool runtime, once it has finished. */
  ms?: number
  sql?: string
  summary?: string
}

export interface TraceData {
  status: "running" | "done" | "error"
  /** Seconds since the run started, as of the latest update. */
  elapsed: number
  steps: TraceStep[]
}

/**
 * Words for the app's own tools. Fixed by the backend's tool names, not by the
 * dataset, which is why it lives here and not in `site.toml`. A tool a dataset
 * adds later falls back to its own name with spaces.
 */
const TOOL_LABELS: Record<string, string> = {
  get_database_schema: "read schema",
  execute_sql_query: "run sql",
  write_debug_report: "write notes",
}

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool.replace(/_/g, " ")
}

/** `2.19` -> `02.2`: a fixed-width timestamp, like a log line. */
function stamp(seconds: number): string {
  return Math.max(0, seconds).toFixed(1).padStart(4, "0")
}

function duration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/**
 * The run's elapsed time, ticking between server updates.
 *
 * The server's figure is the truth at each update; in between, the clock runs
 * on locally from the moment that figure arrived, and stops when the run ends.
 */
function useLiveElapsed(elapsed: number, running: boolean): number {
  const [anchor, setAnchor] = useState(() => ({ elapsed, at: performance.now() }))
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    const at = performance.now()
    setAnchor({ elapsed, at })
    setNow(at)
  }, [elapsed])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(timer)
  }, [running])

  if (!running) return elapsed
  return anchor.elapsed + Math.max(0, now - anchor.at) / 1000
}

export function TraceLog({ data }: { data: TraceData }) {
  const running = data.status === "running"
  const elapsed = useLiveElapsed(data.elapsed, running)
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(null)
  const open = chosenOpen ?? running

  const steps = data.steps ?? []
  const toolRunning = steps.some((step) => step.status === "running")
  const failures = steps.filter((step) => step.status === "error").length
  // The model's current turn began when the last tool finished, or at zero.
  const last = steps[steps.length - 1]
  const thinkingSince = last ? last.t + (last.ms ?? 0) / 1000 : 0

  return (
    <div className="min-w-[16rem] sm:min-w-[24rem] rounded-lg border border-border bg-background/60 font-mono text-xs">
      <button
        type="button"
        onClick={() => setChosenOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left whitespace-nowrap cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("w-3.5 h-3.5 text-faint transition-transform", open && "rotate-90")}
        />
        {running && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-pulse"
          />
        )}
        <span className="uppercase tracking-[0.1em] sm:tracking-[0.16em] text-muted-foreground">agent steps</span>
        <span className="text-faint">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
          {failures > 0 && ` · ${failures} failed`}
          {data.status === "error" && " · stopped"}
        </span>
        <span className="ml-auto tabular-nums text-muted-foreground">{elapsed.toFixed(1)} s</span>
      </button>

      {open && (
        <ol className="border-t border-border px-3 py-2 space-y-1.5" aria-live="polite">
          {steps.map((step) => (
            <li key={step.id} className="grid grid-cols-[2.5rem_1rem_minmax(0,1fr)_auto] items-baseline gap-x-2">
              <span className="tabular-nums text-faint">{stamp(step.t)}</span>
              <StatusGlyph status={step.status} />
              <span className="min-w-0 text-foreground">
                {toolLabel(step.tool)}
                {step.summary && <span className="text-muted-foreground"> · {step.summary}</span>}
              </span>
              <span className="tabular-nums text-faint">
                {step.ms != null ? duration(step.ms) : ""}
              </span>
              {step.sql && <SqlLine sql={step.sql} />}
            </li>
          ))}

          {running && !toolRunning && (
            <li className="grid grid-cols-[2.5rem_1rem_minmax(0,1fr)_auto] items-baseline gap-x-2">
              <span className="tabular-nums text-faint">{stamp(thinkingSince)}</span>
              <StatusGlyph status="running" />
              <span className="text-muted-foreground">
                {steps.length === 0 ? "reading the question" : "thinking"}
              </span>
              <span className="tabular-nums text-faint">
                {Math.max(0, elapsed - thinkingSince).toFixed(1)} s
              </span>
            </li>
          )}
        </ol>
      )}
    </div>
  )
}

function StatusGlyph({ status }: { status: TraceStep["status"] }) {
  if (status === "running") {
    return (
      <span aria-label="running" className="flex h-3 items-center justify-center">
        <span className="h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-pulse" />
      </span>
    )
  }
  // A failed step is not a compliance breach, so it stays neutral rather than
  // borrowing the red that the app reserves for those.
  return status === "done" ? (
    <span aria-label="done" className="text-brand">✓</span>
  ) : (
    <span aria-label="failed" className="text-muted-foreground">✕</span>
  )
}

/** The query a step ran: two lines by default, the whole statement on click. */
function SqlLine({ sql }: { sql: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      title={expanded ? "Collapse query" : "Show the whole query"}
      className={cn(
        "col-start-3 col-span-2 mt-0.5 text-left text-[11px] leading-relaxed text-faint hover:text-muted-foreground whitespace-pre-wrap break-words cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        !expanded && "line-clamp-2",
      )}
    >
      {sql}
    </button>
  )
}
