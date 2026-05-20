import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const user = await requireSchoolUser(request, tenantId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "School authentication required" } },
        { status: 401 }
      );
    }

    const structures = await db.feeStructure.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: structures });
  } catch (error) {
    console.error("List fee structures error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const user = await requireSchoolUser(request, tenantId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "School authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, academicYearId, termId, classId, totalAmount, breakdown } = body;

    if (!name || !academicYearId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name and academicYearId are required" } },
        { status: 400 }
      );
    }

    const structure = await db.feeStructure.create({
      data: {
        tenantId,
        name,
        academicYearId,
        termId: termId || null,
        classId: classId || null,
        totalAmount: Number(totalAmount) || 0,
        breakdown: typeof breakdown === "string" ? breakdown : JSON.stringify(breakdown || {}),
      },
    });

    return NextResponse.json({ success: true, data: structure }, { status: 201 });
  } catch (error) {
    console.error("Create fee structure error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
