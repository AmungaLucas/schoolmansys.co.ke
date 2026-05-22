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

/**
 * PATCH - Update school status OR edit admin email
 */
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
    const { status, planId, expiryDate, adminEmail } = body;

    const tenant = await db.tenant.findUnique({
      where: { id, deletedAt: null },
      include: {
        users: {
          where: { roleId: { not: null } },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    // ---- EDIT ADMIN EMAIL ----
    if (adminEmail) {
      const newEmail = adminEmail.toLowerCase().trim();

      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "A valid email address is required" } },
          { status: 400 }
        );
      }

      const adminUser = tenant.users[0];
      if (!adminUser) {
        return NextResponse.json(
          { success: false, error: { code: "NO_ADMIN", message: "No admin user found for this school" } },
          { status: 404 }
        );
      }

      // Check email uniqueness within the same tenant
      const existing = await db.user.findFirst({
        where: {
          tenantId: id,
          email: newEmail,
          deletedAt: null,
          id: { not: adminUser.id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_EMAIL", message: "A user with this email already exists in this school" } },
          { status: 409 }
        );
      }

      const oldEmail = adminUser.email;

      // Update user email
      await db.user.update({
        where: { id: adminUser.id },
        data: { email: newEmail },
      });

      // Update linked staff record if exists
      await db.staff.updateMany({
        where: { tenantId: id, email: oldEmail },
        data: { email: newEmail },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          action: "UPDATE_ADMIN_EMAIL",
          entityType: "User",
          entityId: adminUser.id,
          details: JSON.stringify({ tenantId: id, tenantName: tenant.name, from: oldEmail, to: newEmail }),
          actorId: admin.userId,
          actorType: "global_user",
        },
      });

      return NextResponse.json({
        success: true,
        data: { email: newEmail },
      });
    }

    // ---- UPDATE STATUS ----
    if (!status) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Status or adminEmail is required" } },
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
 * DELETE - Hard-delete a school and ALL its data (irreversible)
 */
export async function DELETE(
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
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    // Hard delete in dependency order (deepest first) within a transaction
    await db.$transaction(async (tx) => {
      // 1. Nested child records (via parent FKs)
      await tx.curriculumSubStrand.deleteMany({ where: { strand: { tenantId: id } } });
      await tx.curriculumStrand.deleteMany({ where: { tenantId: id } });
      await tx.term.deleteMany({ where: { academicYear: { tenantId: id } } });
      await tx.studentGuardian.deleteMany({ where: { student: { tenantId: id } } });
      await tx.enrolment.deleteMany({ where: { student: { tenantId: id } } });
      await tx.assessment.deleteMany({ where: { tenantId: id } });
      await tx.grade.deleteMany({ where: { tenantId: id } });
      await tx.conductRecord.deleteMany({ where: { tenantId: id } });
      await tx.healthRecord.deleteMany({ where: { tenantId: id } });
      await tx.transportAssignment.deleteMany({ where: { tenantId: id } });

      // 2. Direct child records
      await tx.attendanceArchive.deleteMany({ where: { tenantId: id } });
      await tx.attendance.deleteMany({ where: { tenantId: id } });
      await tx.feePayment.deleteMany({ where: { tenantId: id } });
      await tx.mpesaTransaction.deleteMany({ where: { tenantId: id } });
      await tx.messageQueue.deleteMany({ where: { tenantId: id } });
      await tx.learningArea.deleteMany({ where: { tenantId: id } });
      await tx.class.deleteMany({ where: { tenantId: id } });
      await tx.academicYear.deleteMany({ where: { tenantId: id } });
      await tx.learningLevel.deleteMany({ where: { tenantId: id } });
      await tx.transportRoute.deleteMany({ where: { tenantId: id } });
      await tx.salaryScale.deleteMany({ where: { tenantId: id } });
      await tx.feeStructure.deleteMany({ where: { tenantId: id } });
      await tx.student.deleteMany({ where: { tenantId: id } });
      await tx.guardian.deleteMany({ where: { tenantId: id } });
      await tx.staff.deleteMany({ where: { tenantId: id } });

      // 3. Users and roles (must come after staff/students which may reference users)
      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.role.deleteMany({ where: { tenantId: id } });

      // 4. Payments (global-level but scoped to this tenant)
      await tx.payment.deleteMany({ where: { tenantId: id } });

      // 5. Finally, delete the tenant itself
      await tx.tenant.delete({ where: { id } });
    }, { timeout: 30000 }); // 30s timeout for remote MySQL

    // Audit log (outside transaction since tenant is deleted)
    await db.auditLog.create({
      data: {
        action: "DELETE_SCHOOL",
        entityType: "Tenant",
        entityId: id,
        details: JSON.stringify({ tenantName: tenant.name, subdomain: tenant.subdomain }),
        actorId: admin.userId,
        actorType: "global_user",
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: `School "${tenant.name}" and all associated data have been permanently deleted` },
    });
  } catch (error) {
    console.error("Delete school error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete school. Please try again." } },
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
