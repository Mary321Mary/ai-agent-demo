"use client";

import dynamic from "next/dynamic";

const NewRelicAgent = dynamic(
  () => import("./NewRelicAgent").then((mod) => mod.NewRelicAgent),
  { ssr: false },
);

export function NewRelicClient() {
  return <NewRelicAgent />;
}
