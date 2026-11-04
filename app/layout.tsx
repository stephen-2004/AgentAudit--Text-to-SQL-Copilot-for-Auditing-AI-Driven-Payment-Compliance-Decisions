import type React from "react"
import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import { generateSEOMetadata } from "@/lib/seo/generateMetadata"
import { loadSite } from "@/lib/site/load"
import "./globals.css"

// Prose and headings. 500 is the heading weight; nothing on the page is bolder than 600.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
})
// Numbers, IDs, versions, SQL: anything a reader might copy into a query.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
})

const { seo } = loadSite()

export const metadata: Metadata = {
  ...generateSEOMetadata({
    title: seo.title,
    description: seo.description,
  }),
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0C1219',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className={`${plexSans.className} antialiased bg-background text-foreground`}>{children}</body>
    </html>
  )
}
