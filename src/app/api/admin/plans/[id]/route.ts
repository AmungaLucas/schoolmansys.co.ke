import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

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
    const { name, price, durationDays, maxStudents, maxStaff, features, isActive } = body;

    const plan = await db.plan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
        { status: 404 }
      );
    }

    const updated = await db.plan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(durationDays !== undefined && { durationDays: Number(durationDays) }),
        ...(maxStudents !== undefined && { maxStudents: Number(maxStudents) }),
        ...(maxStaff !== undefined && { maxStaff: Number(maxStaff) }),
        ...(features !== undefined && { features: typeof features === "string" ? features : JSON.stringify(features) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
