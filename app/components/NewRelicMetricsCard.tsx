"use client";

import { motion } from "motion/react";
import { NewRelicMetricsCardProps } from "../utils/newRelic";

export interface NewRelicMetricsOutput {
  region: string;
  windowMinutes: number;
  pageViews: number;
  avgDurationMs: number;
  fetchedAt: string;
}

export function NewRelicMetricsCard({
  state,
  output,
}: NewRelicMetricsCardProps) {
  if (state !== "output-available") {
    return (
      <div className="my-2 animate-pulse rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500">
        Querying New Relic EU (NerdGraph)...
      </div>
    );
  }

  const metrics = output as NewRelicMetricsOutput;

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
          New Relic ({metrics.region}) · {metrics.windowMinutes}m
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
          live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-gray-50 p-2.5">
          <div className="text-gray-500">Page Views</div>
          <div className="text-base font-semibold">{metrics.pageViews}</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2.5">
          <div className="text-gray-500">Avg Duration</div>
          <div className="text-base font-semibold">
            {metrics.avgDurationMs} ms
          </div>
        </div>
      </div>

      <div className="mt-2 text-right text-[11px] text-gray-400">
        Updated at {metrics.fetchedAt}
      </div>
    </motion.div>
  );
}
