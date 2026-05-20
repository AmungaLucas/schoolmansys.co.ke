import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/schools/check-subdomain?subdomain=xxx
 * Dedicated endpoint for exact-match subdomain availability check.
 * Replaces the old pattern of searching the schools list API.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subdomain = (searchParams.get("subdomain") || "").toLowerCase().trim();

    if (!subdomain || subdomain.length < 3) {
      return NextResponse.json({
        success: true,
        data: { available: false, reason: "Subdomain must be at least 3 characters" },
      });
    }

    // Validate format
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json({
        success: true,
        data: { available: false, reason: "Invalid subdomain format" },
      });
    }

    // Exact match using the unique index (includes soft-deleted tenants)
    const existing = await db.tenant.findUnique({
      where: { subdomain },
      select: { id: true, deletedAt: true },
    });

    if (existing && !existing.deletedAt) {
      return NextResponse.json({
        success: true,
        data: { available: false, reason: "Subdomain already taken" },
      });
    }

    return NextResponse.json({
      success: true,
      data: { available: true },
    });
  } catch (error) {
    console.error("Check subdomain error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
