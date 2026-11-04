import { getIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

/**
 * The mark that tags a bubble as the agent's.
 *
 * Three places show it: the banner above the conversation, every assistant
 * message, and the "thinking" placeholder. One component so they cannot drift
 * into three slightly different marks.
 *
 * A magnifier in a scan frame rather than the agent's name from `site.toml`:
 * it has to fit a 32px box, a dataset is free to name its agent something long,
 * and this agent's whole job is inspecting another one.
 */
const Mark = getIcon("ScanSearch")

export function AssistantAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 rounded-lg border border-brand/40 bg-brand/10 text-brand",
        size === "md" ? "w-10 h-10" : "w-8 h-8",
      )}
      aria-hidden="true"
    >
      <Mark className={size === "md" ? "w-5 h-5" : "w-4 h-4"} strokeWidth={1.75} />
    </div>
  )
}
