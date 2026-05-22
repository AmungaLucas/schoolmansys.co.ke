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

    const academicYears = await db.academicYear.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { startDate: "desc" },
      include: {
        terms: {
          where: { deletedAt: null },
          orderBy: { startDate: "asc" },
        },
      },
    });

    return NextResponse.json({ success: true, data: academicYears });
  } catch (error) {
    console.error("List academic years error:", error);
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
    const { name, startDate, endDate, isCurrent, terms } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name, startDate, and endDate are required" } },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // If this is set as current, unset all others
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: { tenantId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      const academicYear = await tx.academicYear.create({
        data: {
          tenantId,
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isCurrent: Boolean(isCurrent),
        },
      });

      // Create terms if provided
      if (terms && Array.isArray(terms)) {
        for (const term of terms) {
          if (!term.name || !term.startDate || !term.endDate) continue;

          await tx.term.create({
            data: {
              tenantId,
              academicYearId: academicYear.id,
              name: term.name,
              startDate: new Date(term.startDate),
              endDate: new Date(term.endDate),
              isCurrent: Boolean(term.isCurrent),
            },
          });
        }
      }

      // Return with terms
      return tx.academicYear.findUnique({
        where: { id: academicYear.id },
        include: {
          terms: { where: { deletedAt: null }, orderBy: { startDate: "asc" } },
        },
      });
    }, { timeout: 30000 });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Create academic year error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
