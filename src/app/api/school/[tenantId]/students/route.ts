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
    const search = searchParams.get("search") || "";
    const classId = searchParams.get("classId") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { admissionNumber: { contains: search } },
      ];
    }
    if (classId) {
      where.enrolments = { some: { classId, status: "active" } };
    }
    if (status) {
      where.status = status;
    }

    const [students, total] = await Promise.all([
      db.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          gender: true,
          status: true,
          currentFeeBalance: true,
          createdAt: true,
          enrolments: {
            where: { status: "active" },
            take: 1,
            orderBy: { dateEnrolled: "desc" },
            select: {
              class: { select: { id: true, name: true, level: { select: { name: true } } } },
            },
          },
        },
      }),
      db.student.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        students,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List students error:", error);
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
    const { admissionNumber, firstName, lastName, gender, dateOfBirth, classId } = body;

    if (!admissionNumber || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "admissionNumber, firstName, and lastName are required" } },
        { status: 400 }
      );
    }

    // Check admission number uniqueness within tenant
    const existing = await db.student.findFirst({
      where: { tenantId, admissionNumber, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Admission number already exists" } },
        { status: 409 }
      );
    }

    const student = await db.student.create({
      data: {
        tenantId,
        admissionNumber,
        firstName,
        lastName,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });

    // Auto-enrol if classId provided
    if (classId) {
      const currentYear = await db.academicYear.findFirst({
        where: { tenantId, isCurrent: true, deletedAt: null },
      });
      if (currentYear) {
        await db.enrolment.create({
          data: {
            tenantId,
            studentId: student.id,
            classId,
            academicYearId: currentYear.id,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: student }, { status: 201 });
  } catch (error) {
    console.error("Create student error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
