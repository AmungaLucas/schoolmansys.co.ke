import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { sendInviteEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

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
  const warnings: string[] = [];

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Admin authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, subdomain, adminName, adminEmail, planId, timezone } = body;

    if (!name || !subdomain || !adminName || !adminEmail) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name, subdomain, adminName, and adminEmail are required" } },
        { status: 400 }
      );
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    const cleanSubdomain = subdomain.toLowerCase().trim();
    if (!subdomainRegex.test(cleanSubdomain)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Subdomain must be lowercase alphanumeric with hyphens (no spaces or special characters)" } },
        { status: 400 }
      );
    }

    // Check subdomain uniqueness
    const existing = await db.tenant.findUnique({ where: { subdomain: cleanSubdomain } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Subdomain already taken" } },
        { status: 409 }
      );
    }

    // Check email uniqueness (only active users — soft-deleted should not block reuse)
    const existingUser = await db.user.findFirst({
      where: { email: adminEmail.toLowerCase().trim(), deletedAt: null },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "This email is already registered in another school" } },
        { status: 409 }
      );
    }

    // Generate invite token and expiry (7 days from now)
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // === MAIN TRANSACTION: Tenant + User only (per spec) ===
    let tenant: Awaited<ReturnType<typeof db.tenant.create>>;
    let schoolAdminRole: Awaited<ReturnType<typeof db.role.create>>;
    let adminUser: Awaited<ReturnType<typeof db.user.create>>;

    try {
      const result = await db.$transaction(async (tx) => {
        // 1. Create tenant (status: provisioning)
        const newTenant = await tx.tenant.create({
          data: {
            name,
            subdomain: cleanSubdomain,
            status: "provisioning",
            planId: planId || null,
            planStartDate: new Date(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
            timezone: timezone || "Africa/Nairobi",
          },
        });

        // 2. Create default roles (CBC spec)
        const roles = await Promise.all([
          tx.role.create({
            data: {
              tenantId: newTenant.id,
              name: "School Admin",
              description: "Full access to school management",
              permissions: JSON.stringify({ all: ["*"] }),
              isDefault: true,
            },
          }),
          tx.role.create({
            data: {
              tenantId: newTenant.id,
              name: "Teacher",
              description: "Academic and attendance access",
              permissions: JSON.stringify({
                students: ["view"],
                attendance: ["view", "mark"],
                assessments: ["view", "create", "edit"],
                grades: ["view", "create", "edit"],
                report_cards: ["view", "generate"],
              }),
            },
          }),
          tx.role.create({
            data: {
              tenantId: newTenant.id,
              name: "Finance Officer",
              description: "Financial management access",
              permissions: JSON.stringify({
                students: ["view"],
                fees: ["view", "collect", "refund"],
                fee_structures: ["view", "create", "edit"],
                reports: ["view"],
              }),
            },
          }),
          tx.role.create({
            data: {
              tenantId: newTenant.id,
              name: "Parent",
              description: "View own children data",
              permissions: JSON.stringify({ own_children: ["view"] }),
            },
          }),
        ]);

        // 3. Create staff record for the admin
        const adminStaff = await tx.staff.create({
          data: {
            tenantId: newTenant.id,
            firstName: adminName.split(" ")[0],
            lastName: adminName.split(" ").slice(1).join(" ") || "Admin",
            email: adminEmail.toLowerCase().trim(),
            designation: "School Administrator",
            dateJoined: new Date(),
            status: "active",
          },
        });

        // 4. Create user account (status: invited, with invite token)
        // Constraint #3: password will be set via accept-invite, no bcrypt hash needed now
        const newUser = await tx.user.create({
          data: {
            tenantId: newTenant.id,
            email: adminEmail.toLowerCase().trim(),
            name: adminName,
            loginableType: "staff",
            loginableId: adminStaff.id,
            roleId: roles[0].id,
            status: "invited",
            inviteToken,
            inviteExpiry,
          },
        });

        // 5. Create audit log
        await tx.auditLog.create({
          data: {
            action: "CREATE_SCHOOL",
            entityType: "Tenant",
            entityId: newTenant.id,
            details: JSON.stringify({ name, subdomain: cleanSubdomain, adminEmail }),
            actorId: admin.userId,
            actorType: "global_user",
          },
        });

        return { tenant: newTenant, role: roles[0], user: newUser };
      });

      tenant = result.tenant;
      schoolAdminRole = result.role;
      adminUser = result.user;
    } catch (txError) {
      console.error("School creation transaction failed:", txError);
      // Update tenant status to provisioning_failed if it was created
      if (tenant) {
        await db.tenant.update({
          where: { id: tenant.id },
          data: { status: "provisioning_failed" },
        }).catch(() => {});
      }
      return NextResponse.json(
        { success: false, error: { code: "PROVISIONING_FAILED", message: "Failed to create school. Please try again." } },
        { status: 500 }
      );
    }

    // === SYNCHRONOUS SEEDING (outside transaction, per spec) ===
    try {
      // Seed academic year and terms (Kenyan 3-term system)
      const currentYear = new Date().getFullYear();
      const academicYear = await db.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: String(currentYear),
          startDate: new Date(currentYear, 0, 27), // Late January
          endDate: new Date(currentYear, 10, 20), // Late November
          isCurrent: true,
        },
      });

      const academicYearId = academicYear.id; // Capture insertId explicitly

      await db.term.createMany({
        data: [
          {
            tenantId: tenant.id,
            academicYearId,
            name: "Term 1",
            startDate: new Date(currentYear, 0, 27),
            endDate: new Date(currentYear, 3, 4),
            isCurrent: true,
          },
          {
            tenantId: tenant.id,
            academicYearId,
            name: "Term 2",
            startDate: new Date(currentYear, 4, 5),
            endDate: new Date(currentYear, 6, 25),
            isCurrent: false,
          },
          {
            tenantId: tenant.id,
            academicYearId,
            name: "Term 3",
            startDate: new Date(currentYear, 8, 1),
            endDate: new Date(currentYear, 10, 20),
            isCurrent: false,
          },
        ],
      });

      // Seed CBC learning levels
      await db.learningLevel.createMany({
        data: [
          { tenantId: tenant.id, name: "Early Years", levelOrder: 1 },
          { tenantId: tenant.id, name: "Lower Primary", levelOrder: 2 },
          { tenantId: tenant.id, name: "Upper Primary", levelOrder: 3 },
          { tenantId: tenant.id, name: "Junior School", levelOrder: 4 },
        ],
      });

      // Seed CBC grading rubric reference (stored as audit log for reference)
      await db.auditLog.create({
        data: {
          action: "SEED_CBC_RUBRIC",
          entityType: "Tenant",
          entityId: tenant.id,
          details: JSON.stringify({
            rubrics: [
              { code: "E", descriptor: "Exceeding Expectation", meaning: "Above the required competency" },
              { code: "M", descriptor: "Meeting Expectation", meaning: "Achieved the expected level" },
              { code: "A", descriptor: "Approaching Expectation", meaning: "Close to meeting but not yet" },
              { code: "B", descriptor: "Below Expectation", meaning: "Not yet achieved" },
            ],
          }),
          actorType: "system",
        },
      });

      // Mark tenant as active
      await db.tenant.update({
        where: { id: tenant.id },
        data: { status: "active" },
      });

    } catch (seedError) {
      console.error("Seeding failed:", seedError);
      await db.tenant.update({
        where: { id: tenant.id },
        data: { status: "provisioning_failed" },
      }).catch(() => {});
      return NextResponse.json(
        { success: false, error: { code: "SEEDING_FAILED", message: "School created but seeding failed. Contact support." } },
        { status: 500 }
      );
    }

    // === SEND INVITE EMAIL (Constraint #4: 5-second timeout with graceful fallback) ===
    try {
      const emailResult = await sendInviteEmail({
        to: adminEmail.toLowerCase().trim(),
        adminName,
        schoolName: name,
        subdomain: cleanSubdomain,
        inviteToken,
      });

      if (!emailResult.success) {
        warnings.push(emailResult.warning || "Email not sent");
      }
    } catch (emailError) {
      console.error("Email error (non-blocking):", emailError);
      warnings.push("Invite email could not be sent. Share the invite link manually.");
    }

    // Return success with or without warnings
    // Note: tenant.status was updated to "active" during seeding — re-read to get fresh value
    return NextResponse.json(
      {
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: "active", // Seeding completed successfully, tenant is now active
          adminEmail: adminUser.email,
          inviteToken,
          // Constraint #8: Copy Link over Email - always return the link
          inviteLink: `${process.env.APP_URL || "https://schoolmansys.co.ke"}/accept-invite?token=${inviteToken}`,
        },
        ...(warnings.length > 0 && { warnings }),
      },
      { status: 201 }
    );
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
