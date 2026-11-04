import type { IconName } from "@/lib/icons"

/**
 * The shape of `data/site.toml`, as TypeScript sees it.
 *
 * This file used to be `config/site.ts`: a TypeScript literal, which the
 * compiler checked for free. TOML gives that up on purpose, so that every
 * authored artifact of a dataset sits in one directory that can be swapped as
 * a unit, and so that the copy can carry real comments next to the sentence
 * they explain. What the compiler used to catch is now caught by `load.ts` at
 * startup: `REQUIRED_SITE_KEYS` for missing keys, `assertIconsExist` for icon
 * names. Both throw rather than render a blank.
 *
 * `icon` is still typed against the names `lib/icons.ts` exports, which is what
 * makes a component's use of an icon name safe. The value arriving from TOML is
 * what needs the runtime check.
 */

/**
 * One of this app's four business lines.
 *
 * Rendered twice, as a card on the home page and again on the agent's welcome
 * screen, from this one entry. It used to be two arrays -- `home.capabilities`
 * and `chat.insights` -- naming the same four things in two vocabularies, and
 * they had already drifted: the second thread was "Portfolio Concentration" on
 * one screen and "Portfolio Health" on the other, with a different icon and no
 * tooltip at all.
 */
export interface Capability {
  icon: IconName
  /** The concept name. Precise to an insider, opaque to everyone else. */
  title: string
  /** One plain line saying what the concept buys you. */
  subtitle: string
  /** Two or three plain sentences defining the title, for a reader outside the domain. */
  tooltip: string
  /** The finding on this thread, drawn as a tag at the end of its audit-trail row. */
  status: CapabilityStatus
}

/**
 * What colour a finding wears. Each tone is a hue with one job, and the job is
 * why it is a closed set: `gap` is the amber used only for a reported number the
 * audit contradicts, `breach` the red used only for a broken rule.
 */
export const STATUS_TONES = ["gap", "breach", "trace"] as const
export type StatusTone = (typeof STATUS_TONES)[number]

export interface CapabilityStatus {
  label: string
  tone: StatusTone
}

/**
 * The home page's thesis: the number the agent reports about itself, beside the
 * number human audits found.
 *
 * The values are numbers, not strings, because the page draws them on a ruler.
 * Both sides share one error-rate scale, so `reported` (an accuracy) is shown
 * there as the error it implies, `100 - reported`.
 */
export interface Evidence {
  reportedTag: string
  reportedLabel: string
  /** Accuracy in percent, as the dashboard reports it. */
  reported: number
  reportedNote: string
  /** Caption for `100 - reported` on the ruler. */
  impliedLabel: string
  auditedTag: string
  auditedLabel: string
  /** Overturn rate in percent, from the human audits. */
  audited: number
  auditedNote: string
  /** `audited - (100 - reported)`, in percentage points. Checked at load. */
  gap: number
  gapLabel: string
}

/** What a kickstart question makes the UI draw. */
export type RenderKind = "table" | "flowchart" | "chart" | "free"

/** One kickstart question, shown as a button above the composer. */
export interface SuggestedAction {
  /**
   * The block this question produces, shown as a glyph on the button.
   *
   * A promise to the reader about what pressing it will look like. What
   * actually delivers the block is a literal trigger phrase inside `action`;
   * `mise run check` refuses to let the two disagree.
   */
  render: RenderKind
  title: string
  label: string
  /** The full sentence actually sent to the agent when the button is pressed. */
  action: string
}

export interface SiteConfig {
  brand: {
    displayName: string
    /** The wordmark, split so the two halves can be coloured differently. */
    logoPrefix: string
    logoAccent: string
    footerName: string
  }
  seo: {
    locale: string
    title: string
    description: string
    keywords: string[]
  }
  home: {
    tagline: string
    description: string
    /** One line describing what the data covers. */
    blurb: string
    techStack: string[]
    headline: { prefix: string; accent: string }
    cta: { title: string; subtitle: string }
    evidence: Evidence
    /** Labels for the overlay that renders `data/business-context.md`. */
    businessContext: { triggerLabel: string; title: string; subtitle: string }
  }
  /** The four business lines, shown on both the home page and the agent. */
  capabilities: Capability[]
  chat: {
    /** What the assistant calls itself in the chat UI. */
    agent: string
    welcomeSubtitle: string
    tryExamples: string
    suggestionsHint: string
    inputPlaceholder: string
    messages: {
      /** The whole sentence in the banner above the conversation, printed as-is. */
      welcomeMessage: string
      /** User submitted while a reply was still streaming. */
      waitForResponse: string
    }
    suggestedActions: SuggestedAction[]
  }
}

/**
 * Every key `data/site.toml` must declare, as dotted paths.
 *
 * Checked by `load.ts` when Next.js reads the file, so a missing key fails the
 * build with the key's name instead of rendering an empty heading on a live
 * page. TOML is not type-checked, so this list is the only thing standing
 * between a typo and an `undefined` in production.
 */
export const REQUIRED_SITE_KEYS: readonly string[] = [
  "brand.displayName",
  "brand.logoPrefix",
  "brand.logoAccent",
  "brand.footerName",
  "seo.locale",
  "seo.title",
  "seo.description",
  "seo.keywords",
  "home.tagline",
  "home.description",
  "home.blurb",
  "home.techStack",
  "home.headline.prefix",
  "home.headline.accent",
  "home.cta.title",
  "home.cta.subtitle",
  "home.evidence.reportedTag",
  "home.evidence.reportedLabel",
  "home.evidence.reported",
  "home.evidence.reportedNote",
  "home.evidence.impliedLabel",
  "home.evidence.auditedTag",
  "home.evidence.auditedLabel",
  "home.evidence.audited",
  "home.evidence.auditedNote",
  "home.evidence.gap",
  "home.evidence.gapLabel",
  "home.businessContext.triggerLabel",
  "home.businessContext.title",
  "home.businessContext.subtitle",
  "capabilities",
  "chat.agent",
  "chat.welcomeSubtitle",
  "chat.tryExamples",
  "chat.suggestionsHint",
  "chat.inputPlaceholder",
  "chat.suggestedActions",
  "chat.messages.welcomeMessage",
  "chat.messages.waitForResponse",
]
