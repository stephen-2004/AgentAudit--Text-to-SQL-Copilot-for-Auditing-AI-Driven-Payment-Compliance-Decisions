"use client"

import { useEffect, useId, useState } from "react"

import { CodeBlock } from "./CodeBlock"
import type { BlockProps } from "./types"

/**
 * The mermaid bundle is close to 1MB and most conversations contain no diagram
 * at all, so it is imported only when the page actually meets its first
 * ```mermaid block. Every later block reuses this one promise.
 */
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        // Diagram source comes from the LLM, which is in turn relaying database
        // content. "strict" runs mermaid's output through DOMPurify and
        // disables HTML labels, and is the only reason rendering it via
        // dangerouslySetInnerHTML below is acceptable.
        securityLevel: "strict",
        // The app is dark-only, so the diagram is too, drawn from the same
        // tokens as `tailwind.config.ts`: panel nodes, cyan edges for the
        // trace. Mermaid needs literal hex here, not CSS variables.
        theme: "base",
        themeVariables: {
          darkMode: true,
          background: "#0C1219",
          fontFamily: "inherit",
          fontSize: "13px",
          primaryColor: "#18222F",
          primaryTextColor: "#E3E9F0",
          primaryBorderColor: "#2C8CA6",
          secondaryColor: "#121A24",
          secondaryTextColor: "#E3E9F0",
          secondaryBorderColor: "#33445A",
          tertiaryColor: "#121A24",
          tertiaryTextColor: "#E3E9F0",
          tertiaryBorderColor: "#33445A",
          lineColor: "#38C6E4",
          textColor: "#E3E9F0",
          nodeTextColor: "#E3E9F0",
          mainBkg: "#18222F",
          nodeBorder: "#2C8CA6",
          clusterBkg: "#121A24",
          clusterBorder: "#33445A",
          edgeLabelBackground: "#121A24",
          titleColor: "#E3E9F0",
        },
        fontFamily: "inherit",
        // Draw at natural size. With mermaid's default (scale to the
        // container), a wide left-to-right flowchart inside a shrink-wrapped
        // chat bubble collapsed to an unreadable strip; the container below
        // scrolls sideways instead.
        flowchart: { useMaxWidth: false },
      })
      return mermaid
    })
  }
  return mermaidPromise
}

/**
 * Renders a ```mermaid block as a diagram, falling back to CodeBlock.
 *
 * Falling back is the normal case, not the exceptional one: while a response
 * streams, the closing fence has not arrived yet, so every chunk hands this
 * component a longer half written diagram that cannot parse. The user sees code
 * first and a diagram the moment the block is complete.
 */
export function MermaidBlock({ source, language }: BlockProps) {
  const [svg, setSvg] = useState<string | null>(null)

  // Keeps two diagrams in one message from colliding. Mermaid uses this as a
  // DOM element id, and the raw useId value contains colons, which are illegal
  // in a selector, so they have to go.
  const domId = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`

  useEffect(() => {
    let cancelled = false

    loadMermaid()
      .then(async (mermaid) => {
        // parse throws on invalid or incomplete source, which is cheaper than
        // letting render fail and then cleaning up after it.
        await mermaid.parse(source)
        const { svg: rendered } = await mermaid.render(domId, source)
        if (!cancelled) setSvg(rendered)
      })
      .catch(() => {
        if (!cancelled) setSvg(null)
      })

    return () => {
      cancelled = true
      // A failed render can leave its temporary measuring node attached to the
      // document. Without this they accumulate for the life of the page.
      document.getElementById(domId)?.remove()
      document.getElementById(`d${domId}`)?.remove()
    }
  }, [source, domId])

  if (!svg) return <CodeBlock source={source} language={language} />

  return (
    <div
      className="my-3 p-4 flex justify-center overflow-x-auto rounded-lg border border-border bg-background"
      // Safe because of securityLevel: "strict" above.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
