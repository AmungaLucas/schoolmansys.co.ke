import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth-guard";
import { Prisma } from "@prisma/client";

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

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "No records provided" } },
        { status: 400 }
      );
    }

    const attendanceDate = new Date(date + "T00:00:00.000Z");
    const validStatuses = ["present", "absent", "late", "excused"];

    // Validate all records before starting the transaction
    for (const record of records) {
      if (!record.studentId || !record.status || !validStatuses.includes(record.status)) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: `Invalid record: ${JSON.stringify(record)}` } },
          { status: 400 }
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;

      for (const record of records) {
        const { studentId, status, remarks } = record;

        // Use upsert keyed on the @@unique([tenantId, studentId, date]) constraint.
        // Previously we used findFirst with classId in the WHERE, which missed
        // existing records saved under a different classId and caused unique
        // constraint violations on create.
        const upserted = await tx.attendance.upsert({
          where: {
            tenantId_studentId_date: {
              tenantId,
              studentId,
              date: attendanceDate,
            },
          },
          update: {
            status,
            classId,
            remarks: remarks || null,
            markedBy: user.userId,
          },
          create: {
            tenantId,
            studentId,
            classId,
            date: attendanceDate,
            status,
            remarks: remarks || null,
            markedBy: user.userId,
          },
        });

        // If the record was created in the last 2 seconds, count it as new;
        // otherwise it was an update of an existing row.
        const ageMs = Date.now() - upserted.createdAt.getTime();
        if (ageMs < 2000) {
          createdCount++;
        } else {
          updatedCount++;
        }
      }

      return { createdCount, updatedCount };
    }, { timeout: 30000 });

    return NextResponse.json({
      success: true,
      data: {
        message: `Attendance saved: ${result.createdCount} new, ${result.updatedCount} updated`,
        ...result,
      },
    });
  } catch (error) {
    console.error("Bulk attendance error:", error);

    // Return the actual error message in development for easier debugging
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "An unexpected error occurred";

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
