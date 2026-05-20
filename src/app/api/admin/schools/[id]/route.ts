import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { sendInviteEmail } from "@/lib/email";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const tenant = await db.tenant.findUnique({
      where: { id, deletedAt: null },
      include: {
        plan: { select: { id: true, name: true, price: true, durationDays: true, maxStudents: true, maxStaff: true, features: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        users: {
          where: { roleId: { not: null } },
          take: 1,
          orderBy: { createdAt: "asc" },
          include: { role: { select: { name: true } } },
        },
        _count: {
          select: {
            students: true,
            staff: true,
            classes: true,
            academicYears: true,
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tenant });
  } catch (error) {
    console.error("Get school error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, planId, expiryDate } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Status is required" } },
        { status: 400 }
      );
    }

    const validStatuses = ["active", "suspended", "expired", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` } },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({ where: { id, deletedAt: null } });
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (planId) updateData.planId = planId;
    if (expiryDate) updateData.expiryDate = new Date(expiryDate);

    const updated = await db.tenant.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "UPDATE_SCHOOL_STATUS",
        entityType: "Tenant",
        entityId: id,
        details: JSON.stringify({ from: tenant.status, to: status }),
        actorId: admin.userId,
        actorType: "global_user",
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update school error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * POST - Resend invite email to a school admin
 * Regenerates the invite token and sends a new email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find the tenant and its admin user
    const tenant = await db.tenant.findUnique({
      where: { id, deletedAt: null },
      include: {
        users: {
          where: { roleId: { not: null } },
          take: 1,
          orderBy: { createdAt: "asc" },
          include: { role: { select: { name: true } } },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    const adminUser = tenant.users[0];
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ADMIN", message: "No admin user found for this school" } },
        { status: 404 }
      );
    }

    // Generate new invite token (7-day expiry)
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update user with new token
    await db.user.update({
      where: { id: adminUser.id },
      data: {
        inviteToken,
        inviteExpiry,
        status: "invited",
        passwordHash: null, // Clear old password so they must set a new one
      },
    });

    const appUrl = process.env.APP_URL || "https://schoolmansys.co.ke";
    const inviteLink = `${appUrl}/accept-invite?token=${inviteToken}`;

    // Send invite email
    const warnings: string[] = [];
    try {
      const emailResult = await sendInviteEmail({
        to: adminUser.email,
        adminName: adminUser.name,
        schoolName: tenant.name,
        subdomain: tenant.subdomain,
        inviteToken,
      });

      if (!emailResult.success) {
        warnings.push(emailResult.warning || "Email not sent");
      }
    } catch (emailError) {
      console.error("Resend invite email error (non-blocking):", emailError);
      warnings.push("Invite email could not be sent. Share the invite link manually.");
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: "RESEND_INVITE",
        entityType: "User",
        entityId: adminUser.id,
        details: JSON.stringify({
          tenantId: tenant.id,
          tenantName: tenant.name,
          email: adminUser.email,
        }),
        actorId: admin.userId,
        actorType: "global_user",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        email: adminUser.email,
        adminName: adminUser.name,
        inviteToken,
        inviteLink,
      },
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    console.error("Resend invite error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
