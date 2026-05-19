import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { createSchoolSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, tenantId } = body;

    if (!email || !password || !tenantId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Email, password, and tenantId are required" } },
        { status: 400 }
      );
    }

    // Verify tenant exists and is active
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "TENANT_NOT_FOUND", message: "School not found" } },
        { status: 404 }
      );
    }

    if (tenant.status !== "active") {
      return NextResponse.json(
        { success: false, error: { code: "TENANT_INACTIVE", message: "School account is not active" } },
        { status: 403 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        tenantId,
        status: "active",
        deletedAt: null,
        passwordHash: { not: null },
      },
      include: {
        role: {
          select: { id: true, name: true, permissions: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createSchoolSession(user.id, tenantId, user.name, user.email, user.roleId);

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId,
        tenantName: tenant.name,
        role: user.role ? { id: user.role.id, name: user.role.name, permissions: user.role.permissions } : null,
      },
    });
  } catch (error) {
    console.error("School login error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
