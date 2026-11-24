import { NextResponse } from "next/server";

interface GroqModelItem {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  active?: boolean;
  context_window?: number;
}

interface GroqModelsResponse {
  data?: GroqModelItem[];
}

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch Groq models (${response.status})`,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as GroqModelsResponse;

    const models = (payload.data ?? [])
      .filter((m) => m.active !== false)
      .map((m) => ({
        id: m.id,
        ownedBy: m.owned_by ?? "unknown",
        contextWindow: m.context_window ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({
      count: models.length,
      ids: models.map((m) => m.id),
      models,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Unexpected error while fetching Groq models",
        details: message,
      },
      { status: 500 },
    );
  }
}
