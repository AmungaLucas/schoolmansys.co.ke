import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subdomain: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [schools, total] = await Promise.all([
      db.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          plan: {
            select: { id: true, name: true, price: true },
          },
          _count: {
            select: {
              students: true,
              staff: true,
              users: true,
            },
          },
        },
      }),
      db.tenant.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        schools,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List schools error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, subdomain, adminName, adminEmail, adminPassword, planId } = body;

    if (!name || !subdomain || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name, subdomain, adminName, adminEmail, and adminPassword are required" } },
        { status: 400 }
      );
    }

    // Check subdomain uniqueness
    const existing = await db.tenant.findUnique({ where: { subdomain } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Subdomain already taken" } },
        { status: 409 }
      );
    }

    const passwordHash = await hash(adminPassword, 12);

    const tenant = await db.$transaction(async (tx) => {
      // Create tenant
      const newTenant = await tx.tenant.create({
        data: {
          name,
          subdomain: subdomain.toLowerCase().trim(),
          status: "active",
          planId: planId || null,
          planStartDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
        },
      });

      // Create default role
      const schoolAdminRole = await tx.role.create({
        data: {
          tenantId: newTenant.id,
          name: "School Admin",
          description: "Full access to school management",
          permissions: JSON.stringify({
            students: { read: true, create: true, update: true, delete: true },
            staff: { read: true, create: true, update: true, delete: true },
            classes: { read: true, create: true, update: true, delete: true },
            fees: { read: true, create: true, update: true, delete: true },
            attendance: { read: true, create: true, update: true },
            guardians: { read: true, create: true, update: true, delete: true },
            reports: { read: true },
          }),
          isDefault: false,
        },
      });

      // Create staff record for the admin
      const adminStaff = await tx.staff.create({
        data: {
          tenantId: newTenant.id,
          firstName: adminName.split(" ")[0],
          lastName: adminName.split(" ").slice(1).join(" ") || "Admin",
          email: adminEmail,
          designation: "School Administrator",
          status: "active",
        },
      });

      // Create user account
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: adminEmail.toLowerCase().trim(),
          passwordHash,
          name: adminName,
          loginableType: "staff",
          loginableId: adminStaff.id,
          roleId: schoolAdminRole.id,
          status: "active",
        },
      });

      // Seed default academic year
      const now = new Date();
      await tx.academicYear.create({
        data: {
          tenantId: newTenant.id,
          name: `${now.getFullYear()} - ${now.getFullYear() + 1}`,
          startDate: new Date(now.getFullYear(), 0, 1),
          endDate: new Date(now.getFullYear() + 1, 11, 31),
          isCurrent: true,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: "CREATE_SCHOOL",
          entityType: "Tenant",
          entityId: newTenant.id,
          details: JSON.stringify({ name, subdomain }),
          actorId: admin.userId,
          actorType: "global_user",
        },
      });

      return newTenant;
    });

    return NextResponse.json({ success: true, data: tenant }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create school error:", error);
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "A record with this value already exists" } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
