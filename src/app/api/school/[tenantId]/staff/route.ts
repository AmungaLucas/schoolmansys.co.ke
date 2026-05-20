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
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const skip = (page - 1) * limit;

    const where: Prisma.StaffWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeNumber: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [staff, total] = await Promise.all([
      db.staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          designation: true,
          qualification: true,
          dateJoined: true,
          status: true,
          createdAt: true,
          classesTaught: {
            where: { deletedAt: null },
            select: { id: true, name: true },
          },
        },
      }),
      db.staff.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        staff,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List staff error:", error);
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
    const { firstName, lastName, email, phone, designation, qualification, dateJoined, employeeNumber } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "firstName and lastName are required" } },
        { status: 400 }
      );
    }

    const staff = await db.staff.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        designation: designation || null,
        qualification: qualification || null,
        dateJoined: dateJoined ? new Date(dateJoined) : null,
        employeeNumber: employeeNumber || null,
        status: "active",
      },
    });

    return NextResponse.json({ success: true, data: staff }, { status: 201 });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
