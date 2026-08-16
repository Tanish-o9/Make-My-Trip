import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Telemetry API Route Handler — Phase 11
 *
 * Receives analytics, web vitals, and error boundaries.
 * Logs them to stdout and appends them to a local JSON file for easy auditing.
 */

const LOG_FILE_PATH = path.join(process.cwd(), "telemetry_logs.jsonl");

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Format logs for Node terminal stdout
    const logPrefix = `[TELEMETRY] [${payload.type.toUpperCase()}]`;
    const logMessage = `${payload.name} ${payload.value !== undefined ? `(${payload.value})` : ""} at ${payload.path}`;
    console.log(`\x1b[35m${logPrefix}\x1b[0m ${logMessage}`, payload.metadata || "");

    // Write to persistent local log file (.jsonl format)
    const logLine = JSON.stringify(payload) + "\n";
    fs.appendFileSync(LOG_FILE_PATH, logLine, "utf8");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[TELEMETRY ROUTE ERROR]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
