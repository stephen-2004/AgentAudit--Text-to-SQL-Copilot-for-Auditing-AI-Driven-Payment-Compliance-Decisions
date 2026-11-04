"use client"

import type { CSSProperties } from "react"

import ConceptTooltip from "@/components/ConceptTooltip"
import { getIcon } from "@/lib/icons"
import type { Capability, StatusTone } from "@/lib/site/schema"

/**
 * One of the app's four business lines, as a row in the audit trail.
 *
 * The home page and the agent's welcome panel both show these four, through
 * `AuditTrail`. One component rather than two so they cannot drift: the
 * previous arrangement had `home.capabilities` and `chat.insights` as separate
 * config, and they had already drifted -- different titles, different icons,
 * and a tooltip on one screen only.
 *
 * `title` is a concept name and is therefore unreadable to anyone outside the
 * domain. `subtitle` is the one-line translation; the tooltip is the paragraph
 * behind it, on hover, focus, or tap. `status` is the finding, at the row's end.
 */
export default function CapabilityCard({
  capability,
  index,
  first = false,
  last = false,
  compact = false,
  className = "",
  style,
}: {
  capability: Capability
  /** Zero-based position in the trail; drawn as `01`..`04`. */
  index: number
  /** The spine starts at the first node and ends at the last, not past them. */
  first?: boolean
  last?: boolean
  compact?: boolean
  className?: string
  style?: CSSProperties
}) {
  const Icon = getIcon(capability.icon)
  // Distance from the row's top edge to its node's centre: padding + margin + half of h-7.
  const nodeCenter = compact ? "26px" : "36px"

  return (
    <li
      className={`relative flex gap-4 sm:gap-5 ${compact ? "py-3" : "py-5"} ${className}`}
      style={style}
    >
      {/* The spine, drawn per row so it meets each node exactly however tall
          the row wraps: one segment above the node, one below. */}
      {!first && (
        <span
          aria-hidden="true"
          // Starts one pixel up so it also covers the divider between rows.
          className="absolute left-[18px] -top-px w-px bg-rule"
          style={{ height: `calc(${nodeCenter} + 1px)` }}
        />
      )}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[18px] bottom-0 w-px bg-rule"
          style={{ top: nodeCenter }}
        />
      )}

      {/* The node the spine passes through. */}
      <span
        aria-hidden="true"
        className={`relative z-10 flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-rule bg-background font-mono text-xs tabular-nums text-brand ${
          compact ? "" : "mt-0.5"
        }`}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 sm:flex-1">
          {/* Full width below `md` so the bubble can hang from the row's right
              edge and stay on a phone screen; shrink-wrapped above it, where the
              bubble centres on the text it explains. */}
          <ConceptTooltip
            text={capability.tooltip}
            align="end"
            className="group w-full md:w-fit max-w-full cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <p
              className={`flex items-center gap-2 font-medium text-foreground ${
                compact ? "text-sm" : "text-base"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {/* The dotted underline is the only thing telling a reader there is
                  something to hover over. Without it the hint is invisible. */}
              <span className="border-b border-dotted border-faint group-hover:border-brand-light group-hover:text-brand-light transition-colors">
                {capability.title}
              </span>
            </p>
            <p
              className={`mt-1 leading-snug text-muted-foreground ${
                compact ? "text-xs" : "text-sm"
              }`}
            >
              {capability.subtitle}
            </p>
          </ConceptTooltip>
        </div>

        <StatusTag label={capability.status.label} tone={capability.status.tone} />
      </div>
    </li>
  )
}

/** Amber and red each have one job, so only these two tones may wear them. */
const TONE_CLASSES: Record<StatusTone, string> = {
  gap: "text-accent border-accent/40 bg-accent/10",
  breach: "text-breach border-breach/40 bg-breach/10",
  trace: "text-brand border-brand/30 bg-brand/5",
}

function StatusTag({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase leading-none tracking-wider ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
