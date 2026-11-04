"use client"

import { useEffect, useId, useState } from "react"
import type { ReactNode } from "react"

/**
 * Explains a domain term on hover, focus, or tap.
 *
 * These four labels name concepts, and a concept name is only readable by
 * someone who already knows the concept. "Widget Yield Variance" is precise
 * to anyone in widget making and opaque to everyone else, which is the wrong way
 * round for a landing page whose whole job is to bring the reader in.
 *
 * Built rather than installed: the app has no tooltip primitive, and one
 * non-interactive hint does not justify a positioning library.
 *
 * Three ways in, on purpose. Hover is the obvious one and the one nobody on a
 * phone or a keyboard can use, so focus and tap open it too, and Escape closes
 * it. The trigger takes `tabIndex={0}` and points at the bubble with
 * `aria-describedby`, which is the ARIA tooltip pattern: the description is
 * announced with the thing it describes rather than stranded somewhere after
 * it in the reading order.
 */
export default function ConceptTooltip({
  text,
  children,
  align = "start",
  className = "",
}: {
  text: string
  children: ReactNode
  /**
   * Which edge the bubble hangs from while the grid is two columns wide.
   *
   * Centring on the card is right on a wide screen and wrong on a phone: the
   * cards are narrower than the bubble there, so a centred bubble on an outer
   * column runs off the screen. Anchoring it to the card's outer edge keeps it
   * on screen, and above `md` -- where the grid opens to four columns and
   * there is room -- both values fall back to centred.
   */
  align?: "start" | "end"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <div
      className={`relative ${className}`}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      // Touch has no hover state, so a tap has to be able to open it.
      onClick={() => setOpen((wasOpen) => !wasOpen)}
    >
      {children}

      {open && (
        <div
          id={id}
          role="tooltip"
          // The bubble must never sit between the pointer and the card, or
          // leaving the card through the bubble would flicker it shut.
          className={`pointer-events-none absolute bottom-full z-30 mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-rule bg-muted p-4 text-left shadow-xl shadow-black/50 md:left-1/2 md:right-auto md:-translate-x-1/2 ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <p className="text-xs leading-relaxed text-foreground/90">{text}</p>
          {/* Caret, a rotated square tucked under the bubble's bottom edge. It
              tracks the bubble's anchor so it keeps pointing at the card. */}
          <span
            aria-hidden="true"
            className={`absolute top-full h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-rule bg-muted md:left-1/2 md:right-auto md:-translate-x-1/2 ${
              align === "end" ? "right-6" : "left-6"
            }`}
          />
        </div>
      )}
    </div>
  )
}
