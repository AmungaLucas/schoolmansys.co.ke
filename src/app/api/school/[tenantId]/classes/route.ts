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

    const classes = await db.class.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        level: { select: { id: true, name: true, levelOrder: true } },
        classTeacher: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: {
            enrolments: {
              where: { status: "active" },
            },
          },
        },
      },
    });

    const result = classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      capacity: cls.capacity,
      level: cls.level,
      classTeacher: cls.classTeacher,
      studentCount: cls._count.enrolments,
      createdAt: cls.createdAt,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("List classes error:", error);
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
    const { name, levelId, classTeacherId, capacity } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Class name is required" } },
        { status: 400 }
      );
    }

    const existing = await db.class.findFirst({
      where: { tenantId, name, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Class name already exists" } },
        { status: 409 }
      );
    }

    const cls = await db.class.create({
      data: {
        tenantId,
        name,
        levelId: levelId || null,
        classTeacherId: classTeacherId || null,
        capacity: Number(capacity) || 40,
      },
    });

    return NextResponse.json({ success: true, data: cls }, { status: 201 });
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
