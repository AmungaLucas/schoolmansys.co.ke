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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalStudents,
      activeStudents,
      totalStaff,
      activeStaff,
      totalClasses,
      totalGuardians,
      todayCollections,
      totalFeePayments,
      outstandingBalance,
      currentAcademicYear,
    ] = await Promise.all([
      db.student.count({ where: { tenantId, deletedAt: null } }),
      db.student.count({ where: { tenantId, status: "active", deletedAt: null } }),
      db.staff.count({ where: { tenantId, deletedAt: null } }),
      db.staff.count({ where: { tenantId, status: "active", deletedAt: null } }),
      db.class.count({ where: { tenantId, deletedAt: null } }),
      db.guardian.count({ where: { tenantId, deletedAt: null } }),
      db.feePayment.aggregate({
        where: {
          tenantId,
          transactionDate: { gte: today, lt: tomorrow },
          status: "success",
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      db.feePayment.aggregate({
        where: { tenantId, status: "success", deletedAt: null },
        _sum: { amount: true },
      }),
      db.student.aggregate({
        where: { tenantId, status: "active", deletedAt: null },
        _sum: { currentFeeBalance: true },
      }),
      db.academicYear.findFirst({
        where: { tenantId, isCurrent: true, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        totalStaff,
        activeStaff,
        totalClasses,
        totalGuardians,
        todayCollections: todayCollections._sum.amount || 0,
        totalFeePayments: totalFeePayments._sum.amount || 0,
        outstandingBalance: outstandingBalance._sum.currentFeeBalance || 0,
        currentAcademicYear,
      },
    });
  } catch (error) {
    console.error("School dashboard error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
