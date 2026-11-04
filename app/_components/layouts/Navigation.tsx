"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

/** One entry in the top bar. */
interface NavItem {
  label: string
  href: string
}

/**
 * The bar is the same on every page, and its two entries are the app's two
 * pages. Not authored copy: a dataset swap rewrites what the app is about,
 * not how many pages it has.
 */
const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Chat", href: "/chat" },
]

export default function Navigation({
  items = DEFAULT_NAV_ITEMS,
  logoPrefix,
  logoAccent,
}: {
  items?: NavItem[]
  /** The wordmark, split so the two halves can be coloured differently. */
  logoPrefix: string
  logoAccent: string
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Wordmark, set in mono like a process name in a log. The cyan
              second half is the trace colour, not the gap amber. */}
          <Link
            href="/"
            className={`flex items-center gap-2.5 rounded-md text-foreground hover:opacity-90 transition-opacity ${focusRing}`}
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-brand" />
            <span className="font-mono text-base font-medium tracking-tight">
              {logoPrefix}
              <span className="text-brand">{logoAccent}</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {items.map((item) => {
              const active = isActive(item.href)
              const isChat = item.href === "/chat"

              if (isChat) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`font-medium text-sm px-4 py-2 bg-brand text-brand-foreground rounded-lg hover:bg-brand-light transition-colors cursor-pointer ${focusRing}`}
                  >
                    Start Chat
                  </Link>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-sm text-sm transition-colors cursor-pointer ${focusRing} ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Mobile Navigation Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${focusRing}`}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border">
            <div className="py-4 space-y-2">
              {items.map((item) => {
                const active = isActive(item.href)
                const isChat = item.href === "/chat"

                if (isChat) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block font-medium text-base py-3 px-4 bg-brand text-brand-foreground text-center rounded-lg mx-4 cursor-pointer"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Start Chat
                    </Link>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block text-base py-3 px-4 transition-colors cursor-pointer ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
