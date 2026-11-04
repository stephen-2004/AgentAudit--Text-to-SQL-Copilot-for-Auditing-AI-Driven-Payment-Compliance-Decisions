import type { Config } from "tailwindcss"

// Tone: a dark graphite-blue audit console, calm and traceable, where cyan
// follows what the agent did, amber marks only the gap between what it reported
// and what auditors found, red is kept for checkpoints that were skipped, and
// every number, ID and query is set in mono like a line in an audit log.
//
// Dark is the only theme. There is no toggle, so no `darkMode` strategy and no
// `dark:` variants: the semantic names below simply hold dark values.
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* The palette. Components name these roles instead of a hex or a raw
       * Tailwind step (`bg-white`, `text-slate-500`), so a rebrand is this block
       * and `app/globals.css` and nothing else.
       *
       * Three hues, each with exactly one job. Spending a hue on decoration
       * would blur the job it carries everywhere else:
       *
       *   brand   trace cyan   anything the reader can follow or act on
       *   accent  gap amber    ONLY the reported-vs-audited gap
       *   breach  red          ONLY a violation, e.g. a skipped checkpoint
       */
      colors: {
        /** Heading ink. Also the filled light pill (shadcn's default button). */
        primary: {
          DEFAULT: "#E3E9F0",
          foreground: "#0C1219",
        },
        /** Trace cyan: links, the send button, focus rings, the trail spine. */
        brand: {
          DEFAULT: "#38C6E4",
          dark: "#1FA5C6", // hover on a filled surface
          light: "#67D5EC", // focus rings, hover text
          soft: "#2C8CA6", // hover borders, quiet rules
          foreground: "#061219",
        },
        /** Gap amber. Reserved for the distance between a reported and an audited number. */
        accent: {
          DEFAULT: "#F5A524",
          foreground: "#1A1204",
        },
        /** Breach red. Reserved for violations; never a series colour, never decoration. */
        breach: {
          DEFAULT: "#F26D6D",
          foreground: "#1A0808",
        },

        /** What a kickstart question will draw, as the thin bar on its left edge.
         *  Taken from the chart series hues so neither amber nor red is spent here. */
        kind: {
          table: "#38C6E4", // cyan
          flowchart: "#9085E9", // violet
          chart: "#3FBF8F", // green
          free: "#33445A", // the rule grey: prose promises no block
        },

        /** Surfaces, darkest to lightest. Panels sit one step above the canvas. */
        background: "#0C1219", // canvas
        surface: "#121A24", // panels, cards, bubbles
        muted: {
          DEFAULT: "#18222F", // inset blocks, hover fills, code
          foreground: "#94A2B4", // secondary text, 6.7:1 on surface
        },
        /** The quietest text that still has to be read: 4.2:1 on surface. */
        faint: "#77869A",

        /** Ink and lines. */
        foreground: "#E3E9F0",
        border: "#243142", // hairlines, what `@apply border-border` resolves to
        rule: "#33445A", // a line meant to be seen: the trail spine, ruler ticks

        // shadcn/ui primitives. Kept whole because `components/ui/*` and any
        // component added with the shadcn CLI expect these exact names.
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      /* Two faces from one superfamily, so prose and data share their metrics.
       *
       *   display / body  IBM Plex Sans   headings at 500, never bold
       *   mono            IBM Plex Mono   every number, ID, version, and SQL
       */
      fontFamily: {
        display: ["var(--font-plex-sans)", "ui-sans-serif", "sans-serif"],
        body: ["var(--font-plex-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      /* Radius is a size ladder, and each step names a role:
       *
       *   rounded-full   pill        status tags, tech-stack tags
       *   rounded-2xl    panel       the modal, the agent welcome panel
       *   rounded-xl     card        evidence panes, kickstart findings, bubbles
       *   rounded-lg     block       code block, table, chart, avatars, buttons
       *   rounded-md/sm  inline      chart tooltip, legend swatches, inline code
       *
       * Nothing is extended here: these are Tailwind's own steps. A shadcn
       * override that derived `lg` from `--radius` once compiled `rounded-lg`
       * and `rounded-xl` to the same 12px, which silently erased the line
       * between a block and the card it sits in.
       */
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
