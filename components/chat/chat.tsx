"use client";

import { AssistantAvatar } from "./AssistantAvatar";
import { PreviewMessage, ThinkingMessage } from "./message";
import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { SiteConfig } from "@/lib/site/schema";

export function Chat({ site }: { site: SiteConfig }) {
  const [input, setInput] = useState("");
  const [isContextBannerVisible, setIsContextBannerVisible] = useState(true);

  const {
    messages,
    sendMessage,
    status,
    stop,
  } = useChat({
    // A spent quota is not an error: the backend answers it with an ordinary
    // message so the user reads it in the conversation. Anything reaching here
    // is a real transport or server failure.
    onError: (error) => toast.error(error.message),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const append = async (message: any): Promise<string | null | undefined> => {
    if (message.content) {
      await sendMessage({ text: message.content });
      return null;
    } else if (message.text) {
      await sendMessage({ text: message.text });
      return null;
    }
    return null;
  };

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end"
        });
      });
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col min-w-0 h-[calc(100dvh-64px)] bg-background">
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-4 flex-1 overflow-y-scroll pt-4 px-4"
      >
        {/* Initial AI Assistant Welcome Display */}
        {messages.length === 0 && <Overview site={site} />}

        {/* Context Banner */}
        {messages.length > 0 && isContextBannerVisible && (
          <div className="max-w-3xl mx-auto w-full">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <AssistantAvatar size="md" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-primary">{site.chat.agent}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {site.chat.messages.welcomeMessage}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsContextBannerVisible(false)}
                  className="text-faint hover:text-foreground transition-colors shrink-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <PreviewMessage key={message.id} message={message} append={append} />
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingMessage />}

        {/* Auto-scroll anchor */}
        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>

      <div className="p-4 bg-background border-t border-border">
        <form className="flex mx-auto gap-2 w-full md:max-w-3xl">
          <MultimodalInput
            site={site}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            messages={messages}
            append={append}
          />
        </form>
      </div>
    </div>
  );
}
