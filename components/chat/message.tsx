"use client";

import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useState } from "react";

import { AssistantAvatar } from "./AssistantAvatar";
import { Markdown } from "./markdown";
import { TraceLog, type TraceData } from "./TraceLog";
import { cn } from "@/lib/utils";

/**
 * Collapsible component for displaying reasoning/thinking content.
 * Shows a summary by default, expands to show full content on click.
 */
const ReasoningBlock = ({ text }: { text: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Truncate text for preview (first 100 chars)
  const previewText = text.length > 100 ? text.slice(0, 100) + "..." : text;

  return (
    // Neutral, not amber: amber is reserved for the reported-vs-audited gap.
    <div className="border border-border rounded-lg bg-muted overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-muted/60 transition-colors"
      >
        <svg
          className={cn(
            "w-4 h-4 text-brand transition-transform",
            isExpanded && "rotate-90"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Thinking
        </span>
        {!isExpanded && (
          <span className="text-xs text-faint truncate flex-1">
            {previewText}
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-3 py-2 border-t border-border">
          <div className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
            {text}
          </div>
        </div>
      )}
    </div>
  );
};

export const PreviewMessage = ({
  message,
  append,
}: {
  message: UIMessage;
  append?: (message: any) => Promise<string | null | undefined>;
}) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn(
          "flex gap-3 w-full",
          message.role === "user" ? "justify-end" : "justify-start"
        )}
      >
        {message.role === "assistant" && <AssistantAvatar />}

        <div
          className={cn(
            "flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] rounded-xl p-4",
            // The user's question is tinted with the trace colour: it is the
            // thread the answer below has to follow.
            message.role === "user"
              ? "bg-brand/10 border border-brand/25 text-foreground"
              : "bg-surface border border-border"
          )}
        >
          {/* AI SDK v5: Use parts instead of content */}
          {message.parts && message.parts.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.parts.map((part: any, index: number) => {
                // The agent's live step log. Arrives first and keeps updating
                // in place until the answer below it lands.
                if (part.type === 'data-trace' && part.data) {
                  return <TraceLog key={part.id ?? index} data={part.data as TraceData} />;
                }
                // Render reasoning/thinking content
                if (part.type === 'reasoning' && part.text) {
                  return (
                    <ReasoningBlock key={index} text={part.text} />
                  );
                }
                // Render text content
                if (part.type === 'text' && part.text) {
                  return (
                    <div
                      key={index}
                      className="text-foreground"
                    >
                      <Markdown
                        onQuestionClick={(question) => {
                          append?.({
                            role: 'user',
                            content: question,
                          });
                        }}
                      >
                        {part.text}
                      </Markdown>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* User Avatar - Right side */}
        {message.role === "user" && (
          <div className="w-8 h-8 flex items-center justify-center border border-border shrink-0 rounded-lg bg-muted">
            <User className="w-4 h-4 text-muted-foreground" aria-label="You" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div className="flex gap-3 w-full justify-start">
        <AssistantAvatar />

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block w-2 h-2 bg-brand rounded-full animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider">Thinking...</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
