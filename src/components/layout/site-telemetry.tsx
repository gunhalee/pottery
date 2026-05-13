"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { scheduleWhenIdle } from "@/lib/browser/schedule-when-idle";

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { ssr: false },
);
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false },
);

export function SiteTelemetry() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const cancel = scheduleWhenIdle(() => setEnabled(true), 2500);

    return cancel;
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
