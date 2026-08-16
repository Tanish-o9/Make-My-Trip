/**
 * Telemetry Client — Phase 11
 *
 * Captures:
 *   1. Funnel analytics (homepage -> search -> book -> payment success/failure)
 *   2. Core Web Vitals (LCP, FID, CLS, INP)
 *   3. 3D & WebGL Error Boundaries
 *
 * Sends payloads to /api/telemetry Next.js route handler.
 */

export interface TelemetryPayload {
  type: "funnel" | "web-vital" | "error";
  name: string;
  value?: number | string;
  path: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export function sendTelemetry(type: TelemetryPayload["type"], name: string, value?: number | string, metadata?: Record<string, any>) {
  if (typeof window === "undefined") return;

  const payload: TelemetryPayload = {
    type,
    name,
    value,
    path: window.location.pathname,
    timestamp: new Date().toISOString(),
    metadata,
  };

  // Log to client console in development
  console.log(`[TELEMETRY] [${type.toUpperCase()}] ${name}:`, { value, ...metadata });

  // Post to the Next.js API Route Handler
  fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn("[TELEMETRY] Delivery failed:", err);
  });
}

// Helper: Log Error Boundary events
export function log3DError(sceneId: string, errorMsg: string, stack?: string) {
  sendTelemetry("error", "3d_canvas_crash", errorMsg, {
    sceneId,
    stack: stack?.slice(0, 300),
    webGLSupported: !!window.WebGLRenderingContext,
  });
}

// Helper: Log Funnel Events
export function logFunnel(stage: "homepage" | "search" | "detail" | "booking_start" | "payment_success" | "payment_failure", metadata?: Record<string, any>) {
  sendTelemetry("funnel", `funnel_${stage}`, undefined, metadata);
}
