import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth-guard";

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
    const { studentId, amount, method, reference, receiptNumber, payeeName, feeStructureId } = body;

    if (!studentId || !amount) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "studentId and amount are required" } },
        { status: 400 }
      );
    }

    // Use transaction to record payment and update balance atomically
    const result = await db.$transaction(async (tx) => {
      // Verify student exists and belongs to this tenant
      const student = await tx.student.findFirst({
        where: { id: studentId, tenantId, deletedAt: null },
      });
      if (!student) {
        throw new Error("STUDENT_NOT_FOUND");
      }

      // Generate receipt number if not provided
      const receipt = receiptNumber || `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create payment record
      const payment = await tx.feePayment.create({
        data: {
          tenantId,
          studentId,
          feeStructureId: feeStructureId || null,
          amount: Number(amount),
          method: method || "cash",
          reference: reference || null,
          receiptNumber: receipt,
          payeeName: payeeName || null,
          collectedBy: user.userId,
          status: "success",
        },
      });

      // Update student fee balance
      await tx.student.update({
        where: { id: studentId },
        data: {
          currentFeeBalance: {
            decrement: Number(amount),
          },
        },
      });

      return { payment, newBalance: student.currentFeeBalance - Number(amount) };
    }, { timeout: 30000 });

    return NextResponse.json({
      success: true,
      data: {
        payment: result.payment,
        newBalance: Math.max(0, result.newBalance),
      },
    });
  } catch (error: unknown) {
    console.error("Record fee payment error:", error);
    const message = error instanceof Error && error.message === "STUDENT_NOT_FOUND"
      ? "Student not found"
      : "An unexpected error occurred";
    const code = error instanceof Error && error.message === "STUDENT_NOT_FOUND"
      ? "NOT_FOUND"
      : "INTERNAL_ERROR";
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: error instanceof Error && error.message === "STUDENT_NOT_FOUND" ? 404 : 500 }
    );
  }
}
