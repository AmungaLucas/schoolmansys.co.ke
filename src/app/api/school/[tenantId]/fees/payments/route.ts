import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth-guard";
import { Prisma } from "@prisma/client";

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

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId") || "";
    const method = searchParams.get("method") || "";
    const status = searchParams.get("status") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const skip = (page - 1) * limit;

    const where: Prisma.FeePaymentWhereInput = { tenantId, deletedAt: null };

    if (studentId) where.studentId = studentId;
    if (method) where.method = method;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) (where.transactionDate as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate) (where.transactionDate as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      db.feePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: "desc" },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true },
          },
        },
      }),
      db.feePayment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payments,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List fee payments error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
