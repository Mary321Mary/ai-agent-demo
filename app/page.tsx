"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";
import { NewRelicErrorsCard } from "./components/NewRelicErrorsCard";
import { NewRelicMetricsCard } from "./components/NewRelicMetricsCard";
import { QUICK_PROMPTS } from "./utils/constants";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const isLoading = status === "submitted" || status === "streaming";

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        scrollToBottom(isLoading ? "auto" : "smooth");
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    isNearBottomRef.current = true;
    sendMessage({ text: input });
    setInput("");
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-6">
      <header className="mb-4 border-b pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">
            AI Ops & Analytics Assistant
          </h1>
          <a
            href="https://github.com/Mary321Mary/ai-agent-demo"
            target="_blank"
            rel="noreferrer"
          >
            GitHub Link
          </a>
        </div>

        <span className="font-mono text-[11px] text-gray-400">
          Next.js · AI SDK · New Relic EU · Gemini / Groq
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Try:</span>
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (isLoading) return;
                isNearBottomRef.current = true;
                sendMessage({ text: item.prompt });
                requestAnimationFrame(() => scrollToBottom("smooth"));
              }}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 space-y-4 overflow-y-auto pr-2"
      >
        <div ref={contentRef} className="space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const hasVisibleParts = message.parts.some(
                (part) =>
                  (part.type === "text" && part.text.trim().length > 0) ||
                  part.type === "tool-getNewRelicMetrics" ||
                  part.type === "tool-getNewRelicErrorsAndSlowPages" ||
                  part.type === "tool-fallbackAssistant",
              );

              if (message.role === "assistant" && !hasVisibleParts) {
                return null;
              }

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className={`flex flex-col ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {message.parts.map((part, idx) => {
                      if (part.type === "text") {
                        return (
                          <p
                            key={idx}
                            className="whitespace-pre-wrap leading-relaxed"
                          >
                            {part.text}
                          </p>
                        );
                      }

                      if (part.type === "tool-fallbackAssistant") {
                        if (part.state !== "output-available") {
                          return (
                            <p key={idx} className="text-xs text-gray-500">
                              Checking available diagnostics &amp; boundaries...
                            </p>
                          );
                        }

                        const fallbackData = part.output as {
                          topic?: string;
                          supportedMetrics?: string[];
                          suggestions?: string[];
                        };

                        return (
                          <div
                            key={idx}
                            className="space-y-1.5 text-xs text-gray-700"
                          >
                            {fallbackData.topic && (
                              <div className="font-medium text-gray-900">
                                Topic: {fallbackData.topic}
                              </div>
                            )}
                            {fallbackData.suggestions &&
                              fallbackData.suggestions.length > 0 && (
                                <ul className="list-disc space-y-1 pl-4">
                                  {fallbackData.suggestions.map(
                                    (item, sIdx) => (
                                      <li key={sIdx}>{item}</li>
                                    ),
                                  )}
                                </ul>
                              )}
                          </div>
                        );
                      }

                      if (part.type === "tool-getNewRelicMetrics") {
                        return (
                          <NewRelicMetricsCard
                            key={idx}
                            state={part.state}
                            output={part.output}
                          />
                        );
                      }

                      if (part.type === "tool-getNewRelicErrorsAndSlowPages") {
                        return (
                          <NewRelicErrorsCard
                            key={idx}
                            state={part.state}
                            output={part.output}
                          />
                        );
                      }

                      return null;
                    })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
        >
          <span className="min-w-0 flex-1 break-words">
            {error.message || "Failed to get response from AI assistant."}
          </span>
          <button
            type="button"
            onClick={() => {
              const lastUserMessage = [...messages]
                .reverse()
                .find((m) => m.role === "user");
              const textPart = lastUserMessage?.parts.find(
                (p) => p.type === "text",
              );
              if (textPart && "text" in textPart && textPart.text.trim()) {
                sendMessage({ text: textPart.text });
              }
            }}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about service metrics..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </main>
  );
}
