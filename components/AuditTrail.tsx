"use client"

import CapabilityCard from "@/components/CapabilityCard"
import type { Capability } from "@/lib/site/schema"

/**
 * The four business threads as one numbered audit trail.
 *
 * A trail rather than a grid because the order in `site.toml` is the order an
 * auditor works in: check the headline number, then who signed, then which
 * release moved it, then whether workload excuses it. A grid would present the
 * four as interchangeable.
 *
 * Both the home page and the agent's welcome panel render this from the same
 * `[[capabilities]]`, so the two screens cannot drift apart again.
 */
export default function AuditTrail({
  capabilities,
  compact = false,
  visible = true,
  className = "",
}: {
  capabilities: Capability[]
  /** The agent's welcome panel has less room than the home page. */
  compact?: boolean
  /** False on the first paint, so the rows can arrive one after another. */
  visible?: boolean
  className?: string
}) {
  return (
    <ol className={className}>
      {capabilities.map((capability, index) => (
        <CapabilityCard
          key={capability.title}
          capability={capability}
          index={index}
          first={index === 0}
          last={index === capabilities.length - 1}
          compact={compact}
          className={`motion-safe:transition-all motion-safe:duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
          style={{ transitionDelay: `${150 + index * 90}ms` }}
        />
      ))}
    </ol>
  )
}
