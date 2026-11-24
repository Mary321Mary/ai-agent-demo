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

export const maxDuration = 30;

interface NrqlMetricRow {
  avgDurationSec?: number;
  pageViews?: number;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const parts: string[] = [];

  if (err instanceof Error) {
    parts.push(err.message, err.name);
  }

  if (typeof err === "object" && err !== null) {
    const anyErr = err as {
      statusCode?: number;
      responseBody?: string;
      message?: string;
    };
    if (anyErr.statusCode === 429) parts.push("429");
    if (typeof anyErr.responseBody === "string")
      parts.push(anyErr.responseBody);
    if (typeof anyErr.message === "string") parts.push(anyErr.message);
    try {
      parts.push(JSON.stringify(err));
    } catch {
      // игнорируем циклические ссылки, если есть
    }
  } else {
    parts.push(String(err));
  }

  const combined = parts.join(" ").toLowerCase();
  return (
    combined.includes("429") ||
    combined.includes("quota exceeded") ||
    combined.includes("rate limit") ||
    combined.includes("resource_exhausted")
  );
}

function buildStreamResult(
  model: LanguageModel,
  modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>,
  onError?: (event: { error: unknown }) => void,
) {
  return streamText({
    model,
    system:
      "You are an observability assistant. When the user asks about website traffic, page views, or browser latency from New Relic, call getNewRelicMetrics.",
    messages: modelMessages,
    stopWhen: stepCountIs(3),
    onError,
    tools: {
      getNewRelicMetrics: tool({
        description:
          "Fetch real browser metrics from New Relic EU via NerdGraph NRQL",
        inputSchema: z.object({
          sinceMinutes: z.number().int().min(5).max(1440).default(60),
        }),
        execute: async ({ sinceMinutes }) => {
          const accountId = process.env.NEW_RELIC_ACCOUNT_ID;
          const apiKey = process.env.NEW_RELIC_USER_API_KEY;

          if (!accountId || !apiKey) {
            throw new Error(
              "Missing NEW_RELIC_ACCOUNT_ID or NEW_RELIC_USER_API_KEY",
            );
          }

          // Экранируем числовое окно времени и формируем NRQL-запрос
          const nrql = `SELECT average(duration) as avgDurationSec, count(*) as pageViews FROM PageView SINCE ${sinceMinutes} minutes ago`;

          const graphqlQuery = `
            query GetBrowserMetrics($accountId: Int!, $nrql: Nrql!) {
              actor {
                account(id: $accountId) {
                  nrql(query: $nrql) {
                    results
                  }
                }
              }
            }
          `;

          const response = await fetch("https://api.eu.newrelic.com/graphql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "API-Key": apiKey,
            },
            body: JSON.stringify({
              query: graphqlQuery,
              variables: {
                accountId: Number(accountId),
                nrql,
              },
            }),
            cache: "no-store",
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `New Relic API error (${response.status}): ${errorText}`,
            );
          }

          const payload = await response.json();

          if (payload.errors?.length) {
            throw new Error(
              `NerdGraph query error: ${payload.errors.map((e: { message: string }) => e.message).join("; ")}`,
            );
          }

          const row: NrqlMetricRow =
            payload.data?.actor?.account?.nrql?.results?.[0] ?? {};

          const pageViews = Number(row.pageViews ?? 0);
          const avgDurationMs = Math.round(
            Number(row.avgDurationSec ?? 0) * 1000,
          );

          return {
            region: "EU",
            windowMinutes: sinceMinutes,
            pageViews,
            avgDurationMs,
            fetchedAt: new Date().toLocaleTimeString(),
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
      let quotaExceeded = false;

      const primary = buildStreamResult(
        primaryModel,
        modelMessages,
        ({ error }) => {
          if (isQuotaOrRateLimitError(error)) {
            quotaExceeded = true;
          }
        },
      );

      // Читаем primary без отправки чанка ошибки в клиентский UI-поток
      try {
        for await (const _ of primary.fullStream) {
          // ждём завершения потока
        }
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          quotaExceeded = true;
        } else {
          throw err;
        }
      }

      if (quotaExceeded) {
        console.warn("Switching to fallback model: qwen/qwen3.8-27b");
        const fallback = buildStreamResult(fallbackModel, modelMessages);
        writer.merge(fallback.toUIMessageStream());
        await fallback.consumeStream();
        return;
      }

      // Если primary отработал без ошибки квоты — отдаём его UI-поток
      writer.merge(primary.toUIMessageStream());
      await primary.consumeStream();
    },
  });

  return createUIMessageStreamResponse({ stream });
}
