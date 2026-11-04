import { BarChart3, Table2, Workflow } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { RenderKind } from "@/lib/site/schema"

/**
 * The mark on a kickstart button saying what pressing it will draw.
 *
 * Twelve buttons all look alike, and three of them produce a table, three a
 * diagram, and three a chart. Without a mark, the only way to find out which is
 * to press one and wait for a model to answer. The mark turns the quota that
 * `data/site.toml` already enforces into something a reader can see.
 *
 * Not authored copy: the mapping lives here rather than inside the question
 * text, so a question stays a sentence and the mark stays presentation.
 * `render = "free"` deliberately draws nothing -- a badge on every button marks
 * nothing at all.
 *
 * These three icons are imported directly rather than through `lib/icons.ts`.
 * That map is the set a dataset's `site.toml` may name; this mapping is fixed
 * by the renderer and is not the dataset author's to choose.
 */
const BADGES: Record<
  Exclude<RenderKind, "free">,
  { Icon: LucideIcon; tag: string; label: string }
> = {
  table: { Icon: Table2, tag: "table + sql", label: "Answers with a table and the SQL" },
  flowchart: { Icon: Workflow, tag: "flow", label: "Answers with a flowchart" },
  chart: { Icon: BarChart3, tag: "chart", label: "Answers with a chart" },
}

/**
 * The thin bar on a kickstart card's left edge, one colour per render kind.
 * Spelled out in full so Tailwind can see every class name.
 */
export const RENDER_BAR: Record<RenderKind, string> = {
  table: "bg-kind-table",
  flowchart: "bg-kind-flowchart",
  chart: "bg-kind-chart",
  free: "bg-kind-free",
}

export function RenderBadge({ render }: { render: RenderKind }) {
  if (render === "free") return null

  const { Icon, tag, label } = BADGES[render]
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-faint group-hover:text-muted-foreground transition-colors"
      role="img"
      aria-label={label}
    >
      <Icon className="!w-3 !h-3 shrink-0" aria-hidden="true" />
      {tag}
    </span>
  )
}
