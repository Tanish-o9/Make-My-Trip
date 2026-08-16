"use client";

/**
 * WebVitalsReporter — Phase 11
 *
 * Listens to Next.js Core Web Vitals (LCP, FID, CLS, INP)
 * and reports them automatically to our telemetry endpoint.
 */

import { useReportWebVitals } from "next/web-vitals";
import { sendTelemetry } from "@/lib/telemetry";

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Send metric value to telemetry endpoint
    sendTelemetry("web-vital", metric.name, metric.value, {
      id: metric.id,
      rating: metric.rating, // 'good', 'needs-improvement', 'poor'
    });
  });

  return null;
}
