import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySchoolSession } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    const session = await verifySchoolSession();
    if (!session || session.userType !== "school") {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        id: session.userId,
        tenantId: session.tenantId,
        deletedAt: null,
      },
      include: {
        role: {
          select: { id: true, name: true, description: true, permissions: true },
        },
        tenant: {
          select: { id: true, name: true, subdomain: true, status: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        loginableType: user.loginableType,
        tenant: user.tenant,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("School me error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
