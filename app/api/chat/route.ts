import { google } from "@ai-sdk/google";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";

// Разрешаем стримингу работать до 30 секунд
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-3.8-flash"),
    system:
      "You are a helpful DevOps & Analytics AI assistant. When the user asks about server metrics, CPU, or latency, always call the getSystemMetrics tool.",
    messages: await convertToModelMessages(messages),
    tools: {
      // getSystemMetrics: tool({
      //   description:
      //     "Get real-time CPU, memory, and latency metrics for a service",
      //   inputSchema: z.object({
      //     serviceName: z
      //       .string()
      //       .describe("Name of the service, e.g. auth-api or billing"),
      //   }),
      //   execute: async ({ serviceName }) => {
      //     // Имитируем запрос к Datadog / New Relic / БД
      //     await new Promise((resolve) => setTimeout(resolve, 600));

      //     return {
      //       service: serviceName,
      //       cpuUsage: Math.floor(Math.random() * 45) + 20, // 20–65%
      //       latencyMs: Math.floor(Math.random() * 80) + 15, // 15–95ms
      //       status: "healthy",
      //       updatedAt: new Date().toLocaleTimeString(),
      //     };
      //   },
      // }),

      // app/api/chat/route.ts
      getSystemMetrics: tool({
        description: "Fetch real-time web performance metrics from New Relic",
        inputSchema: z.object({
          appName: z.string().describe("Application name in New Relic"),
        }),
        execute: async ({ appName }) => {
          const query = `{
            actor {
              account(id: ${process.env.NEW_RELIC_ACCOUNT_ID}) {
                nrql(query: "SELECT average(duration) as avgLatency, count(*) as pageViews FROM PageView WHERE appName = '${appName}' SINCE 1 hour ago") {
                  results
                }
              }
            }
          }`;

          const res = await fetch("https://api.newrelic.com/graphql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "API-Key": process.env.NEW_RELIC_API_KEY!,
            },
            body: JSON.stringify({ query }),
          });

          const json = await res.json();
          const metrics = json.data?.actor?.account?.nrql?.results?.[0] ?? {};

          return {
            service: appName,
            latencyMs: Math.round((metrics.avgLatency ?? 0) * 1000),
            pageViews: metrics.pageViews ?? 0,
            status: "healthy",
            updatedAt: new Date().toLocaleTimeString(),
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
