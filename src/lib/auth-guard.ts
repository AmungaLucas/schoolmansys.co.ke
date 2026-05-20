import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  verifyAdminSession,
  verifySchoolSession,
  type AdminSession,
  type SchoolSession,
} from "@/lib/auth";

/**
 * Verify admin session from request cookies.
 * Returns the admin session data or null if not authenticated.
 */
export async function requireAdmin(
  _request: NextRequest
): Promise<AdminSession | null> {
  try {
    const session = await verifyAdminSession();
    if (!session) return null;
    if (session.userType !== "admin") return null;

    // Verify user still exists and is active
    const user = await db.globalUser.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;

    return session;
  } catch {
    return null;
  }
}

/**
 * Verify school user session for a specific tenant.
 * Returns the user session data or null if not authenticated.
 * Also blocks access if the tenant is suspended or archived.
 */
export async function requireSchoolUser(
  _request: NextRequest,
  tenantId: string
): Promise<(SchoolSession & { roleName: string | null; permissions: string }) | null> {
  try {
    const session = await verifySchoolSession();
    if (!session) return null;
    if (session.userType !== "school") return null;
    if (session.tenantId !== tenantId) return null;

    // Verify tenant exists and is not suspended/archived
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!tenant || tenant.deletedAt) return null;
    if (tenant.status === "suspended" || tenant.status === "archived") return null;

    // Verify user still exists and is active
    const user = await db.user.findFirst({
      where: {
        id: session.userId,
        tenantId,
        status: "active",
        deletedAt: null,
      },
      include: {
        role: {
          select: { name: true, permissions: true },
        },
      },
    });
    if (!user) return null;

    return {
      ...session,
      roleName: user.role?.name ?? null,
      permissions: user.role?.permissions ?? "{}",
    };
  } catch {
    return null;
  }
}
