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
  let isTimeoutOrAbort = false;

  const collect = (value: unknown, depth = 0) => {
    if (!value || depth > 4) return;

    if (value instanceof Error) {
      parts.push(value.message, value.name);
      const lowerName = value.name.toLowerCase();
      if (lowerName === "timeouterror" || lowerName === "aborterror") {
        isTimeoutOrAbort = true;
      }
      if (value.cause) collect(value.cause, depth + 1);
    }

    if (typeof value === "object") {
      const anyErr = value as {
        statusCode?: number;
        code?: string | number;
        name?: string;
        responseBody?: string;
        message?: string;
        lastError?: unknown;
        errors?: unknown[];
      };

      if (typeof anyErr.name === "string") {
        parts.push(anyErr.name);
        const lowerName = anyErr.name.toLowerCase();
        if (lowerName === "timeouterror" || lowerName === "aborterror") {
          isTimeoutOrAbort = true;
        }
      }
      if (anyErr.code !== undefined) {
        parts.push(String(anyErr.code));
        const lowerCode = String(anyErr.code).toLowerCase();
        if (
          lowerCode.includes("timeout") ||
          lowerCode.includes("abort") ||
          lowerCode === "23" // DOMException TIMEOUT_ERR
        ) {
          isTimeoutOrAbort = true;
        }
      }
      if (typeof anyErr.statusCode === "number") {
        parts.push(String(anyErr.statusCode));
      }
      if (typeof anyErr.responseBody === "string") {
        parts.push(anyErr.responseBody);
      }
      if (typeof anyErr.message === "string") {
        parts.push(anyErr.message);
      }
      if (anyErr.lastError) {
        collect(anyErr.lastError, depth + 1);
      }
      if (Array.isArray(anyErr.errors)) {
        for (const inner of anyErr.errors) {
          collect(inner, depth + 1);
        }
      }

      try {
        parts.push(JSON.stringify(value));
      } catch {
        // ignore circular links, if exists
      }
    } else {
      parts.push(String(value));
    }
  };

  collect(err);

  if (isTimeoutOrAbort) {
    return true;
  }

  const combined = parts.join(" ").toLowerCase();
  return (
    combined.includes("429") ||
    combined.includes("503") ||
    combined.includes("502") ||
    combined.includes("504") ||
    combined.includes("quota exceeded") ||
    combined.includes("rate limit") ||
    combined.includes("unavailable") ||
    combined.includes("high demand") ||
    combined.includes("overloaded") ||
    combined.includes("timeout") ||
    combined.includes("timed out") ||
    combined.includes("timeouterror") ||
    combined.includes("aborterror") ||
    combined.includes("aborted") ||
    combined.includes("resource_exhausted")
  );
}
