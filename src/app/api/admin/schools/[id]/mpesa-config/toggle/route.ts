import { NextRequest, NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * PATCH /api/admin/schools/[id]/mpesa-config/toggle
 *
 * Toggle M-Pesa STK Push ON/OFF for a school.
 * When enabling, verifies that a SchoolMpesaConfig exists for the tenant.
 * Requires admin authentication.
 *
 * Body:
 *   - enabled: boolean (required)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const { enabled } = body as { enabled?: boolean };

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'enabled (boolean) is required' },
        },
        { status: 400 }
      );
    }

    // Verify the tenant exists
    const tenant = await withRetry(() =>
      db.tenant.findUnique({
        where: { id },
        select: { id: true, name: true, mpesaStkEnabled: true },
      })
    );

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'School not found' } },
        { status: 404 }
      );
    }

    // If enabling, verify that an M-Pesa config exists
    if (enabled) {
      const mpesaConfig = await withRetry(() =>
        db.schoolMpesaConfig.findUnique({
          where: { tenantId: id },
          select: { id: true, isActive: true },
        })
      );

      if (!mpesaConfig) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NO_CONFIG',
              message: 'Cannot enable M-Pesa: no configuration found. Please configure M-Pesa credentials first.',
            },
          },
          { status: 400 }
        );
      }

      if (!mpesaConfig.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFIG_INACTIVE',
              message: 'Cannot enable M-Pesa: the stored configuration is inactive.',
            },
          },
          { status: 400 }
        );
      }
    }

    // Update the tenant's mpesaStkEnabled flag
    const updated = await withRetry(() =>
      db.tenant.update({
        where: { id },
        data: { mpesaStkEnabled: enabled },
        select: { id: true, name: true, mpesaStkEnabled: true },
      })
    );

    // Audit log
    await withRetry(() =>
      db.auditLog.create({
        data: {
          action: enabled ? 'mpesa_stk_enabled' : 'mpesa_stk_disabled',
          entityType: 'tenant',
          entityId: id,
          details: JSON.stringify({
            schoolName: updated.name,
            previousState: tenant.mpesaStkEnabled,
            newState: enabled,
          }),
          actorId: admin.userId,
          actorType: 'global_user',
        },
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        tenantId: updated.id,
        schoolName: updated.name,
        mpesaStkEnabled: updated.mpesaStkEnabled,
      },
    });
  } catch (error: unknown) {
    console.error('[M-Pesa Toggle] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
