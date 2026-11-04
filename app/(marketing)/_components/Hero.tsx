"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

import AuditTrail from "@/components/AuditTrail"
import BusinessContextModal from "@/components/BusinessContextModal"
import type { SiteConfig } from "@/lib/site/schema"

import EvidencePanel from "./EvidencePanel"

/**
 * The home page, top to bottom in the order an auditor reads a case file:
 * what the system claims and what the audit found (the evidence panel), the
 * four threads to pull on (the trail), then the way in (the call to action).
 */
export default function Hero({
  site,
  businessContext,
}: {
  site: SiteConfig
  /** Raw Markdown of `data/business-context.md`, read on the server. */
  businessContext: string
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const { home, capabilities } = site

  // One fade for every block, staggered by `delay`. `motion-safe:` means a
  // reader who asked for reduced motion gets the page already in place.
  const reveal = (delay: string) =>
    `motion-safe:transition-all motion-safe:duration-700 ${delay} ${
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
    }`

  return (
    <section className="pt-28 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <header className={reveal("motion-safe:delay-0")}>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-brand">
            {home.tagline}
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-primary">
            {home.headline.prefix}
            <span className="text-brand">{home.headline.accent}</span>
          </h1>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-3xl">
              {home.description}
            </p>

            {/* One paragraph cannot carry a whole business domain; this opens
                the two or three screens that can. */}
            <button
              type="button"
              onClick={() => setContextOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 self-start lg:self-auto rounded-lg border border-border bg-surface px-4 py-2 text-sm text-muted-foreground hover:border-brand-soft hover:text-brand-light transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              {home.businessContext.triggerLabel}
            </button>
          </div>
        </header>

        {/* The thesis: reported against audited, and the gap between. */}
        <div className={`mt-12 ${reveal("motion-safe:delay-150")}`}>
          <EvidencePanel evidence={home.evidence} visible={isVisible} />
        </div>

        {/* The four business threads. Same four on the agent's welcome panel,
            from the same `[[capabilities]]`. */}
        <AuditTrail
          capabilities={capabilities}
          visible={isVisible}
          className="mt-14 divide-y divide-border border-y border-border"
        />

        {/* The way in, set like a command prompt. */}
        <div className={`mt-14 ${reveal("motion-safe:delay-500")}`}>
          <Link
            href="/chat"
            className="group flex items-center gap-4 sm:gap-5 rounded-xl border border-border bg-surface p-5 sm:p-6 hover:border-brand-soft transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span aria-hidden="true" className="font-mono text-xl text-brand">
              &rsaquo;
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xl sm:text-2xl font-medium text-primary">{home.cta.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{home.cta.subtitle}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground group-hover:bg-brand-light transition-colors">
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 motion-safe:transition-transform" />
            </span>
          </Link>
        </div>

        {/* What the record covers, and what the app is built on. */}
        <div
          className={`mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${reveal("motion-safe:delay-700")}`}
        >
          <p className="font-mono text-xs leading-relaxed text-faint max-w-2xl">{home.blurb}</p>
          <ul className="flex flex-wrap gap-2">
            {home.techStack.map((tech) => (
              <li
                key={tech}
                className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground"
              >
                {tech}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BusinessContextModal
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        labels={home.businessContext}
        markdown={businessContext}
      />
    </section>
  )
}
