import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs"; // Constraint #3: bcryptjs only
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Token and password are required" } },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters long" } },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Password must contain uppercase, lowercase, and a number" } },
        { status: 400 }
      );
    }

    // Find user by invite token (Constraint #6: explicit tenant scoping)
    const user = await db.user.findFirst({
      where: {
        inviteToken: token,
        status: "invited",
        inviteExpiry: { gt: new Date() },
      },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true, status: true } },
        role: { select: { id: true, name: true, permissions: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "Invite token is invalid, expired, or already used" } },
        { status: 400 }
      );
    }

    // Check tenant is active
    if (user.tenant.status !== "active") {
      return NextResponse.json(
        { success: false, error: { code: "TENANT_INACTIVE", message: "The school account is not active. Please contact support." } },
        { status: 403 }
      );
    }

    // Hash password (Constraint #3: bcryptjs, NOT bcrypt)
    const passwordHash = await hash(password, 12);

    // Update user: set password, clear token, activate
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteToken: null,
        inviteExpiry: null,
        status: "active",
        lastLoginAt: new Date(),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "ACCEPT_INVITE",
        entityType: "User",
        entityId: user.id,
        details: JSON.stringify({ tenantId: user.tenantId, email: user.email }),
        actorType: "system",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        tenantName: user.tenant.name,
        tenantId: user.tenant.id,
        tenantSubdomain: user.tenant.subdomain,
        role: user.role?.name,
      },
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

/**
 * GET - Validate invite token (for the accept-invite page to pre-check)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Token is required" } },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        inviteToken: token,
        status: "invited",
        inviteExpiry: { gt: new Date() },
      },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true, status: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "Invite link is invalid or expired" } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        schoolName: user.tenant.name,
        adminName: user.name,
        email: user.email,
        tenantId: user.tenant.id,
        subdomain: user.tenant.subdomain,
      },
    });
  } catch (error) {
    console.error("Validate invite error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
