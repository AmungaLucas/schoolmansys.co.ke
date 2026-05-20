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

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId") || "";
    const dateStr = searchParams.get("date") || "";

    if (!classId || !dateStr) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "classId and date query params are required" } },
        { status: 400 }
      );
    }

    // Use UTC to be consistent with the bulk-save endpoint
    const date = new Date(dateStr + "T00:00:00.000Z");
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get students enrolled in this class
    const enrolments = await db.enrolment.findMany({
      where: { classId, tenantId, status: "active" },
      select: { studentId: true },
    });

    const studentIds = enrolments.map((e) => e.studentId);

    const students = await db.student.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
      orderBy: { admissionNumber: "asc" },
    });

    // Query attendance by studentIds + date range.
    // Do NOT filter by classId here because the @@unique constraint on
    // Attendance is [tenantId, studentId, date] — a student can only have
    // one record per date regardless of class.
    const attendanceRecords = await db.attendance.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        date: { gte: date, lt: nextDay },
      },
      select: { studentId: true, status: true, remarks: true },
    });

    const attendanceMap = new Map(attendanceRecords.map((r) => [r.studentId, r]));

    const result = students.map((s) => {
      const record = attendanceMap.get(s.id);
      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNumber: s.admissionNumber,
        status: record?.status || null,
        remarks: record?.remarks || null,
        marked: !!record,
      };
    });

    // Summary stats
    const summary = {
      total: students.length,
      present: attendanceRecords.filter((r) => r.status === "present").length,
      absent: attendanceRecords.filter((r) => r.status === "absent").length,
      late: attendanceRecords.filter((r) => r.status === "late").length,
      unmarked: students.length - attendanceRecords.length,
    };

    return NextResponse.json({
      success: true,
      data: { students: result, summary },
    });
  } catch (error) {
    console.error("Get attendance error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
