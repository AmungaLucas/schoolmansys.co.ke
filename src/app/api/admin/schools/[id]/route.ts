import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

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
