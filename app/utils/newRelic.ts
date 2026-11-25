export interface NrqlMetricRow {
  avgDurationSec?: number;
  pageViews?: number;
}

export interface NewRelicMetricsCardProps {
  state: string;
  output?: unknown;
}

export interface NrqlResponse {
  data?: {
    actor?: {
      account?: {
        nrql?: {
          results?: Record<string, unknown>[];
        };
      };
    };
  };
  errors?: { message: string }[];
}

export async function runNewRelicNrql(
  nrql: string,
): Promise<Record<string, unknown>[]> {
  const accountId = process.env.NEW_RELIC_ACCOUNT_ID;
  const apiKey = process.env.NEW_RELIC_API_KEY;

  if (!accountId || !apiKey) {
    throw new Error("Missing NEW_RELIC_ACCOUNT_ID or NEW_RELIC_API_KEY");
  }

  const graphqlQuery = `
    query RunNrql($accountId: Int!, $nrql: Nrql!) {
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
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`New Relic API error (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as NrqlResponse;

  if (payload.errors?.length) {
    throw new Error(
      `NerdGraph query error: ${payload.errors.map((e) => e.message).join("; ")}`,
    );
  }

  return payload.data?.actor?.account?.nrql?.results ?? [];
}

export function isQuotaOrRateLimitError(err: unknown): boolean {
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
      // ignore circular links, if exists
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
