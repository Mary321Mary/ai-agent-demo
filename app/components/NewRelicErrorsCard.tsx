"use client";

import { motion } from "motion/react";
import { NewRelicMetricsCardProps } from "../utils/newRelic";

export interface SlowestPageMetric {
  pageUrl: string;
  p95DurationMs: number;
  hits: number;
}

export interface NewRelicErrorsOutput {
  region: string;
  windowMinutes: number;
  errorCount: number;
  slowestPages: SlowestPageMetric[];
  fetchedAt: string;
}

export function NewRelicErrorsCard({
  state,
  output,
}: NewRelicMetricsCardProps) {
  if (state !== "output-available") {
    return (
      <div className="my-2 animate-pulse rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500">
        Querying New Relic EU errors &amp; slow pages...
      </div>
    );
  }

  const data = output as NewRelicErrorsOutput;
  const topP95Ms = data.slowestPages[0]?.p95DurationMs ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
      }}
      className="my-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-mono font-semibold text-gray-700">
          New Relic ({data.region}) · {data.windowMinutes}m · Errors &amp; p95
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
          live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-gray-50 p-2.5">
          <div className="text-gray-500">JS Errors</div>
          <div
            className={`text-base font-semibold ${
              data.errorCount > 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {data.errorCount}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2.5">
          <div className="text-gray-500">Top p95 Duration</div>
          <div className="text-base font-semibold">{topP95Ms} ms</div>
        </div>
      </div>

      {data.slowestPages.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5 text-xs">
          <div className="text-[11px] font-medium text-gray-500">
            Slowest pages (p95)
          </div>
          {data.slowestPages.map((page, pageIdx) => (
            <div
              key={`${page.pageUrl}-${pageIdx}`}
              className="flex items-center justify-between gap-2 rounded-md bg-gray-50/80 px-2.5 py-1.5"
            >
              <span
                title={page.pageUrl}
                className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-700"
              >
                {page.pageUrl}
              </span>
              <span className="shrink-0 font-semibold text-gray-900">
                {page.p95DurationMs} ms
              </span>
              <span className="shrink-0 text-[11px] text-gray-400">
                ({page.hits})
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 text-right text-[11px] text-gray-400">
        Updated at {data.fetchedAt}
      </div>
    </motion.div>
  );
}
