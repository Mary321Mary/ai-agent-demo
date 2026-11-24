"use client";

import { useEffect, useRef } from "react";

export function NewRelicAgent() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || initializedRef.current) {
      return;
    }

    const accountId = process.env.NEXT_PUBLIC_NR_ACCOUNT_ID;
    const appId = process.env.NEXT_PUBLIC_NR_APP_ID;
    const licenseKey = process.env.NEXT_PUBLIC_NR_LICENSE_KEY;

    if (!accountId || !appId || !licenseKey) {
      return;
    }

    initializedRef.current = true;

    let cancelled = false;

    import("@newrelic/browser-agent/loaders/browser-agent")
      .then(({ BrowserAgent }) => {
        if (cancelled) return;

        new BrowserAgent({
          init: {
            browser_consent_mode: { enabled: false },
            privacy: { cookies_enabled: true },
            distributed_tracing: { enabled: true },
            performance: { capture_measures: true },
            ajax: {
              deny_list: ["bam.eu01.nr-data.net"],
              capture_payloads: "none",
            },
          },
          info: {
            beacon: "bam.eu01.nr-data.net",
            errorBeacon: "bam.eu01.nr-data.net",
            licenseKey,
            applicationID: appId,
            sa: 1,
          },
          loader_config: {
            accountID: accountId,
            trustKey: accountId,
            agentID: appId,
            licenseKey,
            applicationID: appId,
          },
        });
      })
      .catch(() => {
        initializedRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
