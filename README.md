# AI Ops & Analytics Assistant

An interactive observability and analytics assistant built with **Next.js (App Router)**, **Vercel AI SDK**, **New Relic EU NerdGraph**, and **Framer Motion**. It streams real-time browser telemetry into rich UI cards, handles out-of-scope requests gracefully, and automatically falls back across LLM providers when rate limits or quota errors occur.

## Live Demo

- **Deployed App:** [https://ai-agent-demo-henna.vercel.app](https://ai-agent-demo-henna.vercel.app)

## Key Features

- **Real-Time New Relic EU Telemetry (NerdGraph NRQL):**
  - **Web Performance Metrics (`getNewRelicMetrics`):** Fetches `PageView` counts and average load duration (converted to milliseconds) over a configurable time window (`5` to `1440` minutes).
  - **Error & Latency Diagnostics (`getNewRelicErrorsAndSlowPages`):** Queries browser JavaScript error counts and slowest pages ranked by `p95` duration and hit count.
  - **Scope Guardrails (`fallbackAssistant`):** Handles requests outside available telemetry or actions that require manual investigation/configuration, returning supported capabilities and next steps.
- **Multi-Provider Fallback (Gemini → Groq):** Streams responses from a primary Gemini model and automatically switches to a Groq fallback model when primary quota/rate-limit errors (`429` / resource exhausted) are detected.
- **Responsive Streaming UX:**
  - Dedicated UI cards (`NewRelicMetricsCard`, `NewRelicErrorsCard`) rendered dynamically as tool outputs arrive.
  - Quick-prompt buttons in the header for one-click testing of metrics, diagnostics, and out-of-scope scenarios.
  - `ResizeObserver`-driven auto-scroll that tracks streaming height changes while respecting manual scroll-up behavior.
  - Empty assistant bubble filtering and an error banner with a **Retry** action for network or provider failures.

## Tech Stack

- **Framework:** Next.js (App Router) & React
- **AI & Streaming:** Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/google`, `@ai-sdk/groq`)
- **Observability:** New Relic EU NerdGraph GraphQL API (`https://api.eu.newrelic.com/graphql`)
- **Animations & Styling:** Framer Motion (`motion/react`) & Tailwind CSS

## Project Structure

```text
app/
├── api/
│   └── chat/
│       └── route.ts                  # Streaming endpoint, Gemini -> Groq fallback, and AI SDK tools
├── components/
│   ├── NewRelicMetricsCard.tsx       # Traffic & average load duration card
│   └── NewRelicErrorsCard.tsx        # JS errors & p95 slowest pages card
├── utils/
│   └── newRelic.ts                   # Centralized `runNewRelicNrql` NerdGraph helper
└── page.tsx                          # Chat UI, quick prompts, ResizeObserver scroll & error retry banner
```

## Environment Variables

Create a `.env` file in the project root and configure:

```env
# New Relic EU Account Credentials
NEW_RELIC_ACCOUNT_ID=your_eu_account_id
NEW_RELIC_API_KEY=your_new_relic_user_or_ingest_key
NEXT_PUBLIC_NR_LICENSE_KEY=your_new_relic_license_key
NEXT_PUBLIC_NR_APP_ID=your_new_relic_app_id

# Primary & Fallback LLM Providers
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key
GROQ_API_KEY=your_groq_api_key
```

> **Note:** Make sure your New Relic browser agent is reporting data to the **EU** region under the target `appName` used in your NRQL queries.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your environment variables to `.env`.

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` and click one of the header prompt pills or ask about browser metrics, JS errors, or slowest pages.

## Example Prompts

- **Metrics:** `"Fetch real-time web performance metrics from New Relic"`
- **Diagnostics:** `"Show browser JavaScript errors and slowest pages by p95 latency from New Relic"`
- **Out of Scope:** `"Can you restart the production server and configure alert rules?"`
