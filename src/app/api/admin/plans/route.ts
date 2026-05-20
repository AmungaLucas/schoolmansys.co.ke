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

    const plans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
      include: {
        _count: {
          select: { tenants: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error("List plans error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, price, durationDays, maxStudents, maxStaff, features } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Plan name is required" } },
        { status: 400 }
      );
    }

    const plan = await db.plan.create({
      data: {
        name,
        price: Number(price) || 0,
        durationDays: Number(durationDays) || 365,
        maxStudents: Number(maxStudents) || 100,
        maxStaff: Number(maxStaff) || 20,
        features: typeof features === "string" ? features : JSON.stringify(features || {}),
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error("Create plan error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
