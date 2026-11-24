"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop } = useChat();

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
          Try asking: &ldquo;Check metrics for auth-api&rdquo;
        </p>
      </header>

      {/* Список сообщений */}
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
                  // 1. Обычный стриминговый текст
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

                  // 2. Generative UI: рендер карточки при вызове getSystemMetrics
                  if (part.type === "tool-getSystemMetrics") {
                    if (part.state !== "output-available") {
                      return (
                        <div
                          key={idx}
                          className="my-2 animate-pulse rounded-xl border border-gray-300 bg-white p-3 text-xs text-gray-500"
                        >
                          Fetching live telemetry...
                        </div>
                      );
                    }

                    const data = part.output as {
                      service: string;
                      cpuUsage: number;
                      latencyMs: number;
                      status: string;
                      updatedAt: string;
                    };

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 28,
                        }}
                        className="my-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold uppercase text-gray-700">
                            {data.service}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {data.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg bg-gray-50 p-2">
                            <div className="text-gray-500">CPU Load</div>
                            <div className="text-base font-semibold">
                              {data.cpuUsage}%
                            </div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-2">
                            <div className="text-gray-500">P95 Latency</div>
                            <div className="text-base font-semibold">
                              {data.latencyMs} ms
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-right text-[11px] text-gray-400">
                          Updated at {data.updatedAt}
                        </div>
                      </motion.div>
                    );
                  }

                  return null;
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Поле ввода */}
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
