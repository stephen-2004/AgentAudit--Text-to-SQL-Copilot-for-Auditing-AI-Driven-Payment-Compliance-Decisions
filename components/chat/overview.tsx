import { motion } from "framer-motion";

import AuditTrail from "@/components/AuditTrail";
import type { SiteConfig } from "@/lib/site/schema";

import { AssistantAvatar } from "./AssistantAvatar";

export const Overview = ({ site }: { site: SiteConfig }) => {
  const { chat, capabilities } = site;

  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto w-full md:mt-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ delay: 0.2 }}
    >
      <div className="rounded-2xl border border-border bg-surface">
        <div className="px-5 py-7 sm:px-8 sm:py-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <AssistantAvatar size="md" />
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-medium text-primary">
                {chat.agent}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {chat.welcomeSubtitle}
              </p>
            </div>
          </div>

          {/* The same four business threads the home page shows, from the same
              `[[capabilities]]`. Two arrays here is how the two screens drifted
              apart last time. */}
          <AuditTrail
            capabilities={capabilities}
            compact
            className="divide-y divide-border border-y border-border"
          />

          {/* Example prompts */}
          <p className="mt-5 font-mono text-xs leading-relaxed text-faint">
            {chat.tryExamples}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
