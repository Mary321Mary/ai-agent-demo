"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";
import { NewRelicErrorsCard } from "./components/NewRelicErrorsCard";
import { NewRelicMetricsCard } from "./components/NewRelicMetricsCard";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat();

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-6">
      <header className="mb-4 border-b pb-3">
        <h1 className="text-xl font-semibold">AI Ops & Analytics Assistant</h1>
        <p className="text-sm text-gray-500">
          Try asking: &ldquo;Fetch real-time web performance metrics from New
          Relic&rdquo;
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
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
                              {fallbackData.suggestions.map((item, sIdx) => (
                                <li key={sIdx}>{item}</li>
                              ))}
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
          ))}
        </AnimatePresence>
      </div>

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
