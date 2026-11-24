import { google } from "@ai-sdk/google";
import {
  streamText,
  tool,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
} from "ai";
import { z } from "zod";

export const maxDuration = 30;

interface NrqlMetricRow {
  avgDurationSec?: number;
  pageViews?: number;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-3.8-flash"),
    system:
      "You are an observability assistant. When the user asks about website traffic, page views, or browser latency from New Relic, call getNewRelicMetrics.",
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(3),
    tools: {
      getNewRelicMetrics: tool({
        description:
          "Fetch real browser metrics (page views and average duration) from New Relic EU via NerdGraph NRQL",
        inputSchema: z.object({
          sinceMinutes: z
            .number()
            .int()
            .min(5)
            .max(1440)
            .default(60)
            .describe("Time window in minutes, e.g. 60 for the last hour"),
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

  return result.toUIMessageStreamResponse();
}
