import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const [
      totalSchools,
      activeSchools,
      expiredSchools,
      provisioningFailed,
      recentAuditLogs,
    ] = await Promise.all([
      db.tenant.count({ where: { deletedAt: null } }),
      db.tenant.count({ where: { status: "active", deletedAt: null } }),
      db.tenant.count({
        where: {
          status: "expired",
          deletedAt: null,
          expiryDate: { lt: new Date() },
        },
      }),
      db.tenant.count({ where: { status: "provisioning_failed", deletedAt: null } }),
      db.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          details: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalSchools,
        activeSchools,
        expiredSchools,
        provisioningFailed,
        recentAuditLogs,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
