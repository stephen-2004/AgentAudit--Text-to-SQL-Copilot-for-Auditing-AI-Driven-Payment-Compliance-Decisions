/**
 * The full-page placeholder Next.js shows while a route segment loads.
 *
 * One component behind both `loading.tsx` files. They were two near-identical
 * copies differing only in the word under the spinner, which is exactly the
 * shape that drifts: a colour changed on one page and not the other.
 *
 * A scanning trace line rather than a spinner: the same cyan rule the audit
 * trail is drawn with, so the wait already looks like the page it leads to.
 */
export function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 w-48">
        <div className="relative h-px w-full overflow-hidden bg-rule">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-brand animate-pulse" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  )
}
