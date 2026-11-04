"use client";

import type { ChatRequestOptions, UIMessage } from "ai";
import { motion } from "framer-motion";
import type React from "react";
import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { cn } from "@/lib/utils";

import { ArrowUpIcon, StopIcon } from "./icons";
import { RENDER_BAR, RenderBadge } from "./RenderBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SiteConfig } from "@/lib/site/schema";

export function MultimodalInput({
  site,
  input,
  setInput,
  isLoading,
  stop,
  messages,
  append,
  handleSubmit,
  className,
}: {
  site: SiteConfig;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  messages: Array<UIMessage>;
  append: (
    message: any,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    "",
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const submitForm = useCallback(() => {
    handleSubmit(undefined, {});
    setLocalStorageInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [handleSubmit, setLocalStorageInput, width]);

  return (
    <div className="relative w-full flex flex-col gap-3">
      {/* Suggested Questions */}
      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {site.chat.suggestionsHint}
          </p>

          <div className="max-h-[320px] sm:max-h-[280px] overflow-y-auto">
            <div className="grid sm:grid-cols-2 gap-2 w-full pr-1">
              {site.chat.suggestedActions.map((suggestedAction, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.05 * index }}
                  key={`suggested-action-${suggestedAction.title}-${index}`}
                >
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      append({
                        role: "user",
                        content: suggestedAction.action,
                      });
                    }}
                    // Set like a finding in an audit report: a coloured edge for
                    // the kind of evidence it returns, a mono reference, the
                    // finding's name, then the question in plain words.
                    className="group relative overflow-hidden text-left border border-border bg-surface hover:bg-muted hover:border-rule pl-4 pr-3 py-2.5 text-sm flex-col gap-1 w-full h-auto justify-start items-stretch whitespace-normal transition-colors cursor-pointer rounded-lg focus-visible:ring-offset-background"
                  >
                    <span
                      aria-hidden="true"
                      className={cn("absolute left-0 top-0 bottom-0 w-0.5", RENDER_BAR[suggestedAction.render])}
                    />
                    {/* The mark says what pressing this will draw. Nine of the
                        twelve produce a table, a flowchart, or a chart; without
                        a mark the only way to find out is to press one. */}
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] tabular-nums text-faint">
                        F-{String(index + 1).padStart(2, "0")}
                      </span>
                      <RenderBadge render={suggestedAction.render} />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {suggestedAction.title}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground group-hover:text-brand-light transition-colors">
                      {suggestedAction.label}
                    </span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Message Input Form */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder={site.chat.inputPlaceholder}
          value={input}
          onChange={handleInput}
          className={cn(
            "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none !text-base",
            "bg-surface border border-border rounded-xl",
            "focus-visible:border-brand-soft focus-visible:ring-brand/40 focus-visible:ring-2 focus-visible:ring-offset-0",
            "text-foreground placeholder:text-faint",
            "pr-12",
            className,
          )}
          rows={3}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();

              if (isLoading) {
                toast.error(site.chat.messages.waitForResponse);
              } else {
                submitForm();
              }
            }
          }}
        />

        {isLoading ? (
          <Button
            className="p-2 h-fit absolute bottom-2 right-2 bg-muted border border-rule hover:bg-muted/70 text-foreground cursor-pointer rounded-lg"
            onClick={(event) => {
              event.preventDefault();
              stop();
            }}
          >
            <StopIcon size={16} />
          </Button>
        ) : (
          <Button
            className="p-2 h-fit absolute bottom-2 right-2 bg-brand hover:bg-brand-light text-brand-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer rounded-lg"
            onClick={(event) => {
              event.preventDefault();
              submitForm();
            }}
            disabled={input.length === 0}
          >
            <ArrowUpIcon size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
