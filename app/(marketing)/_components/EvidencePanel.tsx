"use client"

import type { Evidence } from "@/lib/site/schema"

/**
 * The home page's thesis: what the agent reports about itself, beside what the
 * human audits found, with the gap between them measured on a ruler.
 *
 * The two headline numbers are not the same kind of number, an accuracy on the
 * left and an error rate on the right, so the ruler is what makes them
 * comparable: both are drawn on one error-rate scale, the left one as the error
 * its accuracy implies. The amber band between the two marks is the gap, and
 * it is the only amber on the page.
 *
 * Every value comes from `[home.evidence]` in `data/site.toml`; `load.ts` has
 * already checked that the stated gap matches the two numbers.
 */
export default function EvidencePanel({
  evidence,
  visible,
}: {
  evidence: Evidence
  /** False on the first paint, so the gap band can grow into place. */
  visible: boolean
}) {
  const implied = 100 - evidence.reported

  return (
    <figure className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* The ruler is drawn for the eye; this is the same reading for a screen reader. */}
      <figcaption className="sr-only">
        {evidence.reportedLabel} {pct(evidence.reported)}, {evidence.impliedLabel}{" "}
        {pct(implied)}. {evidence.auditedLabel} {pct(evidence.audited)}.{" "}
        {evidence.gapLabel} {evidence.gap.toFixed(1)} percentage points.
      </figcaption>

      <div className="grid md:grid-cols-[1fr_11rem_1fr]">
        {/* Reported: grey, because it is the number nobody checked. Mirrored
            toward the ruler on a wide screen so both figures flank it. */}
        <div className="p-6 sm:p-8 md:text-right">
          <p className="flex items-center gap-2 md:justify-end font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            {evidence.reportedTag}
          </p>
          <p className="mt-6 text-sm text-foreground">{evidence.reportedLabel}</p>
          <p className="mt-1 font-mono text-5xl sm:text-6xl tracking-tight tabular-nums text-muted-foreground">
            {evidence.reported.toFixed(1)}
            <span className="text-3xl sm:text-4xl">%</span>
          </p>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            = {pct(implied)} {evidence.impliedLabel}
          </p>
          <p className="mt-5 text-sm leading-relaxed text-faint max-w-xs md:ml-auto">
            {evidence.reportedNote}
          </p>
        </div>

        <GapRuler
          implied={implied}
          audited={evidence.audited}
          gap={evidence.gap}
          gapLabel={evidence.gapLabel}
          visible={visible}
        />

        {/* Audited: amber, the one number here a person produced. */}
        <div className="p-6 sm:p-8">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {evidence.auditedTag}
          </p>
          <p className="mt-6 text-sm text-foreground">{evidence.auditedLabel}</p>
          <p className="mt-1 font-mono text-5xl sm:text-6xl tracking-tight tabular-nums text-accent">
            {evidence.audited.toFixed(1)}
            <span className="text-3xl sm:text-4xl">%</span>
          </p>
          {/* No gap readout here: the ruler beside this pane already states it. */}
          <p className="mt-5 text-sm leading-relaxed text-faint max-w-xs md:mt-[2.75rem]">
            {evidence.auditedNote}
          </p>
        </div>
      </div>
    </figure>
  )
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * One error-rate axis from zero to a round ceiling above the larger mark.
 *
 * Vertical between the two panes on a wide screen, horizontal between them
 * when they stack. Both orientations are the same drawing with the axis turned,
 * so one `at()` places every element in either.
 */
function GapRuler({
  implied,
  audited,
  gap,
  gapLabel,
  visible,
}: {
  implied: number
  audited: number
  gap: number
  gapLabel: string
  visible: boolean
}) {
  const max = Math.max(5, Math.ceil((Math.max(implied, audited) * 1.2) / 5) * 5)
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const share = (v: number) => (v / max) * 100
  const band = share(audited) - share(implied)
  const mid = share((implied + audited) / 2)

  // The band grows from the implied mark to the audited one on first paint.
  // `motion-safe:` keeps it still for anyone who asked for reduced motion.
  const grow = "motion-safe:transition-all motion-safe:duration-1000 motion-safe:delay-300 ease-out"

  return (
    <div aria-hidden="true" className="border-y md:border-y-0 md:border-x border-border">
      {/* Vertical, between the panes. Zero at the foot, like a gauge. */}
      <div className="relative hidden md:block h-full min-h-[18rem] py-10">
        <div className="relative h-full">
          <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-rule" />
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute left-1/2 h-px -translate-x-1/2 bg-rule"
              style={{ bottom: `${share(t)}%`, width: t % 5 === 0 ? 16 : 8 }}
            />
          ))}
          {[0, max].map((t) => (
            <span
              key={t}
              className="absolute left-[calc(50%+14px)] translate-y-1/2 font-mono text-[10px] text-faint"
              style={{ bottom: `${share(t)}%` }}
            >
              {t}%
            </span>
          ))}

          <span
            className={`absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-accent ${grow}`}
            style={{ bottom: `${share(implied)}%`, height: visible ? `${band}%` : "0%" }}
          />

          <Mark at={share(implied)} tone="reported" label={pct(implied)} vertical />
          <Mark at={share(audited)} tone="audited" label={pct(audited)} vertical />

          <span
            className={`absolute left-[calc(50%+14px)] translate-y-1/2 font-mono leading-tight text-accent ${grow} ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ bottom: `${mid}%` }}
          >
            <span className="block text-lg tabular-nums">{gap.toFixed(1)}</span>
            <span className="block text-[10px] uppercase tracking-[0.18em]">pp {gapLabel}</span>
          </span>
        </div>
      </div>

      {/* Horizontal, when the panes stack. Zero at the left. */}
      <div className="md:hidden px-6 sm:px-8 py-6">
        <div className="relative h-20">
          <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-rule"
              style={{ left: `${share(t)}%`, height: t % 5 === 0 ? 16 : 8 }}
            />
          ))}
          {[0, max].map((t) => (
            <span
              key={t}
              className={`absolute bottom-0 font-mono text-[10px] text-faint ${
                t === 0 ? "" : "-translate-x-full"
              }`}
              style={{ left: `${share(t)}%` }}
            >
              {t}%
            </span>
          ))}

          <span
            className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent ${grow}`}
            style={{ left: `${share(implied)}%`, width: visible ? `${band}%` : "0%" }}
          />

          <Mark at={share(implied)} tone="reported" label={pct(implied)} />
          <Mark at={share(audited)} tone="audited" label={pct(audited)} />

          <span
            className={`absolute bottom-0 -translate-x-1/2 font-mono text-[11px] text-accent whitespace-nowrap ${grow} ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ left: `${mid}%` }}
          >
            {gap.toFixed(1)} pp {gapLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

/** A dot on the axis with its value beside it: left of a vertical axis, above a horizontal one. */
function Mark({
  at,
  tone,
  label,
  vertical = false,
}: {
  at: number
  tone: "reported" | "audited"
  label: string
  vertical?: boolean
}) {
  const dot = tone === "audited" ? "bg-accent" : "bg-muted-foreground"
  const ink = tone === "audited" ? "text-accent" : "text-muted-foreground"

  if (vertical) {
    return (
      <>
        <span
          className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full ring-4 ring-surface ${dot}`}
          style={{ bottom: `${at}%` }}
        />
        <span
          className={`absolute right-[calc(50%+14px)] translate-y-1/2 font-mono text-xs tabular-nums ${ink}`}
          style={{ bottom: `${at}%` }}
        >
          {label}
        </span>
      </>
    )
  }
  return (
    <>
      <span
        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-surface ${dot}`}
        style={{ left: `${at}%` }}
      />
      <span
        className={`absolute top-0 -translate-x-1/2 font-mono text-xs tabular-nums ${ink}`}
        style={{ left: `${at}%` }}
      >
        {label}
      </span>
    </>
  )
}
