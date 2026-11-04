import { cn } from "@/lib/utils"

import type { BlockProps } from "./types"

/**
 * A plain fenced code block.
 *
 * It is also the fallback for the whole block layer. An unknown language, a
 * renderer that was removed, a Mermaid syntax error, and a block that is still
 * streaming all end up here. That is why it does nothing that could throw.
 *
 * Sunk one step below the bubble it sits in, like a terminal pane, with the
 * fence's language as a mono label. That label is how a reader tells the SQL
 * the agent ran apart from a chart that is still streaming in.
 */
export function CodeBlock({ source, language }: BlockProps) {
  return (
    <div className="my-3 rounded-lg border border-border bg-background overflow-hidden">
      {language && (
        <div className="border-b border-border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          {language}
        </div>
      )}
      <pre className="p-4 overflow-x-auto">
        <code
          className={cn(
            "font-mono text-[13px] leading-relaxed text-foreground/90",
            language && `language-${language}`
          )}
        >
          {source}
        </code>
      </pre>
    </div>
  )
}
