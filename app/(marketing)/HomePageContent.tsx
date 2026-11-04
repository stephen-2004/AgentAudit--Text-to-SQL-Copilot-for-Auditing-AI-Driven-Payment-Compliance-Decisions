"use client"

import Hero from "./_components/Hero"
import type { SiteConfig } from "@/lib/site/schema"

export default function HomePageContent({
  site,
  businessContext,
}: {
  site: SiteConfig
  businessContext: string
}) {
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Hero site={site} businessContext={businessContext} />

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono text-xs text-faint">
            &copy; {new Date().getFullYear()} {site.brand.footerName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
