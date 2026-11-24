"use client";

import { useEffect } from "react";
import { BrowserAgent } from "@newrelic/browser-agent/loaders/browser-agent";

export function NewRelicAgent() {
  useEffect(() => {
    new BrowserAgent({
      init: {
        browser_consent_mode: { enabled: false },
        privacy: { cookies_enabled: true },
        distributed_tracing: { enabled: true },
        performance: { capture_measures: true },
        ajax: { deny_list: ["bam.eu01.nr-data.net"], capture_payloads: "none" },
      },
      info: {
        beacon: "bam.eu01.nr-data.net",
        errorBeacon: "bam.eu01.nr-data.net",
        licenseKey: process.env.NEXT_PUBLIC_NR_LICENSE_KEY!,
        applicationID: process.env.NEXT_PUBLIC_NR_APP_ID!,
        sa: 1,
      },
      loader_config: {
        accountID: process.env.NEW_RELIC_ACCOUNT_ID!,
        trustKey: process.env.NEW_RELIC_ACCOUNT_ID!,
        agentID: process.env.NEXT_PUBLIC_NR_APP_ID!,
        licenseKey: process.env.NEXT_PUBLIC_NR_LICENSE_KEY!,
        applicationID: process.env.NEXT_PUBLIC_NR_APP_ID!,
      },
    });
  }, []);

  return null;
}
