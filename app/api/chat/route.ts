import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
  LanguageModel,
} from "ai";
import { z } from "zod";
import {
  isQuotaOrRateLimitError,
  NrqlMetricRow,
  runNewRelicNrql,
} from "../../utils/newRelic";

export const maxDuration = 30;

function buildStreamResult(
  model: LanguageModel,
  modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>,
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
    onError?: (event: { error: unknown }) => void;
  },
) {
  return streamText({
    model,
    system:
      "You are an observability assistant for New Relic EU (app: 'ai-agent-demo'). " +
      "Call getNewRelicMetrics for website traffic, page views, or average browser load duration. " +
      "Call getNewRelicErrorsAndSlowPages for JavaScript errors, failures, slow pages, or p95 latency. " +
      "Call fallbackAssistant ONLY when the request is outside these browser telemetry metrics or requires actions/investigations not covered by them." +
      "When a UI tool card renders metrics, errors, or page tables, do NOT repeat raw tables or " +
      "duplicate the full list in text. Provide only a concise 1-2 sentence insight or caveat below the card.",
    messages: modelMessages,
    stopWhen: stepCountIs(3),
    maxRetries: options?.maxRetries ?? 0,
    abortSignal: options?.timeoutMs
      ? AbortSignal.timeout(options.timeoutMs)
      : undefined,
    onError: (event) => options?.onError?.(event),
    tools: {
      getNewRelicMetrics: tool({
        description:
          "Fetch real browser metrics from New Relic EU via NerdGraph NRQL",
        inputSchema: z.object({
          sinceMinutes: z.number().int().min(5).max(1440).default(60),
        }),
        execute: async ({ sinceMinutes }) => {
          const rawMinutes =
            typeof sinceMinutes === "number" ? sinceMinutes : 60;
          const safeMinutes = Math.min(
            1440,
            Math.max(5, Math.trunc(rawMinutes)),
          );
          const rows = await runNewRelicNrql(
            `SELECT average(duration) as avgDurationSec, count(*) as pageViews ` +
              `FROM PageView WHERE appName = 'ai-agent-demo' SINCE ${safeMinutes} minutes ago`,
          );

          const row = (rows[0] ?? {}) as NrqlMetricRow;
          const pageViews = Number(row.pageViews ?? 0);
          const avgDurationMs = Math.round(
            Number(row.avgDurationSec ?? 0) * 1000,
          );

          return {
            region: "EU",
            windowMinutes: safeMinutes,
            pageViews,
            avgDurationMs,
            fetchedAt: new Date().toLocaleTimeString(),
          };
        },
      }),
      getNewRelicErrorsAndSlowPages: tool({
        description:
          "Fetch browser JavaScript error counts and slowest pages (p95 duration) " +
          "from New Relic EU when the user asks about errors, failures, slow pages, or p95 latency.",
        inputSchema: z.object({
          sinceMinutes: z.number().int().min(5).max(1440).default(60),
        }),
        execute: async ({ sinceMinutes }) => {
          const safeMinutes = Math.min(
            1440,
            Math.max(5, Math.trunc(sinceMinutes)),
          );

          const [errorRows, slowPageRows] = await Promise.all([
            runNewRelicNrql(
              `SELECT count(*) as errorCount FROM JavaScriptError ` +
                `WHERE appName = 'ai-agent-demo' SINCE ${safeMinutes} minutes ago`,
            ).catch(() => []),
            runNewRelicNrql(
              `SELECT percentile(duration, 95) as p95Sec, count(*) as hits ` +
                `FROM PageView WHERE appName = 'ai-agent-demo' FACET pageUrl ` +
                `SINCE ${safeMinutes} minutes ago LIMIT 5`,
            ).catch(() => []),
          ]);

          const errorCount = Number(errorRows[0]?.errorCount ?? 0);
          const slowestPages = slowPageRows.map((row) => ({
            pageUrl: String(row.facet ?? row.pageUrl ?? "unknown"),
            p95DurationMs: Math.round(Number(row.p95Sec ?? 0) * 1000),
            hits: Number(row.hits ?? 0),
          }));

          return {
            region: "EU",
            windowMinutes: safeMinutes,
            errorCount,
            slowestPages,
            fetchedAt: new Date().toLocaleTimeString(),
          };
        },
      }),
      fallbackAssistant: tool({
        description:
          "Use ONLY when the user asks something outside New Relic browser telemetry " +
          "(PageView count, average load duration, JS error count, and p95 slowest pages) " +
          "or asks for actions/investigations that cannot be answered directly from available telemetry. " +
          "Returns guidance, limitations, and next steps.",
        inputSchema: z.object({
          topic: z
            .string()
            .describe("Short summary of what the user is asking about"),
          reason: z
            .enum([
              "out_of_scope_metric",
              "requires_action",
              "insufficient_data",
            ])
            .describe("Why telemetry tools do not cover the request"),
        }),
        execute: async ({ topic, reason }) => {
          return {
            handledByFallbackTool: true,
            topic,
            reason,
            supportedMetrics: [
              "PageView count",
              "Average page load duration (ms)",
              "JavaScript error count",
              "Slowest pages (p95 duration & hit count)",
            ],
            supportedRegion: "EU",
            suggestions: [
              "Specify a time window in minutes (for example, last 30 or 60 minutes) for browser metrics.",
              "Check New Relic UI directly for deeper traces, logs, or alert configuration.",
            ],
          };
        },
      }),
    },
  });
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const primaryModel = google("gemini-3.8-flash");
  const fallbackModel = groq("qwen/qwen3.8-27b");

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let shouldFallback = false;
      let hasContent = false;

      const primary = buildStreamResult(primaryModel, modelMessages, {
        maxRetries: 0,
        timeoutMs: 8000,
        onError: ({ error }) => {
          if (isQuotaOrRateLimitError(error)) {
            shouldFallback = true;
          }
        },
      });

      try {
        for await (const chunk of primary.fullStream) {
          if (
            chunk.type === "text-delta" ||
            chunk.type === "tool-call" ||
            chunk.type === "tool-input-start"
          ) {
            hasContent = true;
          }

          if (chunk.type === "error") {
            if (isQuotaOrRateLimitError(chunk.error)) {
              shouldFallback = true;
              break;
            }
            throw chunk.error;
          }
        }
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          shouldFallback = true;
        } else {
          throw err;
        }
      }

      if (shouldFallback && !hasContent) {
        console.warn("Switching to fallback model: qwen/qwen3.8-27b");
        const fallback = buildStreamResult(fallbackModel, modelMessages, {
          maxRetries: 1,
          timeoutMs: 20000,
        });
        writer.merge(fallback.toUIMessageStream());
        await fallback.consumeStream();
        return;
      }

      writer.merge(primary.toUIMessageStream());
      await primary.consumeStream();
    },
  });

  return createUIMessageStreamResponse({ stream });
}
