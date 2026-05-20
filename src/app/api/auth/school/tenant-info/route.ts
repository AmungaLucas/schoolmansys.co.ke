import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/auth/school/tenant-info?tenantId=xxx
 * Returns basic tenant info (name, status) for the login page branding.
 * No auth required — this is a public endpoint used on the login page.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "tenantId is required" } },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: { id: true, name: true, subdomain: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tenant });
  } catch (error) {
    console.error("Tenant info error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
