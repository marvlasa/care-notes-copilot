import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint for load balancers and monitoring
 */
export async function GET() {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {} as Record<string, any>,
  };

  // Check PostgreSQL
  try {
    await pool.query("SELECT 1");
    checks.checks.database = { status: "up" };
  } catch (error) {
    checks.status = "unhealthy";
    checks.checks.database = {
      status: "down",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks.checks.redis = { status: "up" };
  } catch (error) {
    checks.status = "unhealthy";
    checks.checks.redis = {
      status: "down",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const statusCode = checks.status === "healthy" ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}

