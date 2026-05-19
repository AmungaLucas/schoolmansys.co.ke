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
    const { classId, date, records } = body;

    if (!classId || !date || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "classId, date, and records array are required" } },
        { status: 400 }
      );
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const validStatuses = ["present", "absent", "late", "excused"];

    const result = await db.$transaction(async (tx) => {
      const created = [];
      const updated = [];

      for (const record of records) {
        const { studentId, status, remarks } = record;

        if (!studentId || !status || !validStatuses.includes(status)) continue;

        // Check if record already exists
        const existing = await tx.attendance.findFirst({
          where: {
            tenantId,
            studentId,
            classId,
            date: attendanceDate,
          },
        });

        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status, remarks: remarks || null },
          });
          updated.push(existing.id);
        } else {
          const newRecord = await tx.attendance.create({
            data: {
              tenantId,
              studentId,
              classId,
              date: attendanceDate,
              status,
              remarks: remarks || null,
              markedBy: user.userId,
            },
          });
          created.push(newRecord.id);
        }
      }

      return { createdCount: created.length, updatedCount: updated.length };
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Attendance saved: ${result.createdCount} new, ${result.updatedCount} updated`,
        ...result,
      },
    });
  } catch (error) {
    console.error("Bulk attendance error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
