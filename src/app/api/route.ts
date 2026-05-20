import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check + database connectivity test.
 * Call GET /api to verify the app is running and DB is reachable.
 */
export async function GET() {
  try {
    // Test database connectivity
    const start = Date.now();
    const result = await db.$queryRaw`SELECT 1 as ok`;
    const dbTime = Date.now() - start;

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      dbResponseTime: `${dbTime}ms`,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV || "not set",
        dbHost: process.env.DATABASE_URL?.replace(/:.*@/, ':***@') || "not set",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : "UNKNOWN";
    return NextResponse.json({
      status: "unhealthy",
      database: "disconnected",
      error: message,
      errorCode: code,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV || "not set",
        dbHost: process.env.DATABASE_URL?.replace(/:.*@/, ':***@') || "not set",
      },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
