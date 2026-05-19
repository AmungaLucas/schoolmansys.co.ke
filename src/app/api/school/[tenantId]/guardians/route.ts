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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const skip = (page - 1) * limit;

    const where: Prisma.GuardianWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [guardians, total] = await Promise.all([
      db.guardian.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          students: {
            include: {
              student: {
                select: { id: true, firstName: true, lastName: true, admissionNumber: true },
              },
            },
          },
        },
      }),
      db.guardian.count({ where }),
    ]);

    const result = guardians.map((g) => ({
      ...g,
      linkedStudents: g.students.map((sg) => ({
        ...sg.student,
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        guardians: result,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List guardians error:", error);
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
    const { firstName, lastName, phone, email, idNumber, occupation, relationship, address } = body;

    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "firstName, lastName, and phone are required" } },
        { status: 400 }
      );
    }

    const guardian = await db.guardian.create({
      data: {
        tenantId,
        firstName,
        lastName,
        phone,
        email: email || null,
        idNumber: idNumber || null,
        occupation: occupation || null,
        relationship: relationship || null,
        address: address || null,
      },
    });

    return NextResponse.json({ success: true, data: guardian }, { status: 201 });
  } catch (error) {
    console.error("Create guardian error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
