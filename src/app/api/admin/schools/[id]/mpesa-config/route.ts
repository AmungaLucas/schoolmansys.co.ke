import { NextRequest, NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';
import { encrypt, decrypt, getEncryptionKey, maskSecret } from '@/lib/crypto';

/**
 * GET /api/admin/schools/[id]/mpesa-config
 *
 * Get a school's M-Pesa configuration with masked secrets.
 * Requires admin authentication.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(_request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify the tenant (school) exists
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

    // Get the M-Pesa config for this tenant
    const config = await withRetry(() =>
      db.schoolMpesaConfig.findUnique({
        where: { tenantId: id },
        select: {
          id: true,
          consumerKey: true,
          consumerSecretEncrypted: true,
          passkeyEncrypted: true,
          shortcode: true,
          tillNumber: true,
          environment: true,
          isActive: true,
          lastTestedAt: true,
          lastTestResult: true,
          configuredById: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    );

    if (!config) {
      return NextResponse.json({
        success: true,
        data: {
          config: null,
          mpesaStkEnabled: tenant.mpesaStkEnabled,
          maskedSecrets: false,
        },
      });
    }

    // Decrypt and mask secrets
    let maskedConsumerSecret = '****';
    let maskedPasskey = '****';
    try {
      const encryptionKey = getEncryptionKey();
      const rawSecret = decrypt(config.consumerSecretEncrypted, encryptionKey);
      const rawPasskey = decrypt(config.passkeyEncrypted, encryptionKey);
      maskedConsumerSecret = maskSecret(rawSecret);
      maskedPasskey = maskSecret(rawPasskey);
    } catch {
      // If decryption fails, show generic masked values
    }

    return NextResponse.json({
      success: true,
      data: {
        config: {
          id: config.id,
          consumerKey: maskSecret(config.consumerKey),
          consumerSecretMasked: maskedConsumerSecret,
          passkeyMasked: maskedPasskey,
          shortcode: config.shortcode,
          tillNumber: config.tillNumber,
          environment: config.environment,
          isActive: config.isActive,
          lastTestedAt: config.lastTestedAt,
          lastTestResult: config.lastTestResult,
          configuredAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
        mpesaStkEnabled: tenant.mpesaStkEnabled,
        maskedSecrets: true,
      },
    });
  } catch (error: unknown) {
    console.error('[M-Pesa Config GET] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/schools/[id]/mpesa-config
 *
 * Save or update a school's M-Pesa configuration.
 * Encrypts sensitive credentials before storing.
 * Requires admin authentication.
 *
 * Body:
 *   - consumerKey: string (required)
 *   - consumerSecret: string (required, plain text — will be encrypted)
 *   - passkey: string (required, plain text — will be encrypted)
 *   - shortcode: string (required)
 *   - tillNumber?: string (optional)
 *   - environment: 'sandbox' | 'production' (default: 'sandbox')
 */
export async function PUT(
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

    const { consumerKey, consumerSecret, passkey, shortcode, tillNumber, environment } = body as {
      consumerKey?: string;
      consumerSecret?: string;
      passkey?: string;
      shortcode?: string;
      tillNumber?: string;
      environment?: string;
    };

    // Validate required fields
    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'consumerKey, consumerSecret, passkey, and shortcode are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate environment
    const envValue = environment === 'production' ? 'production' : 'sandbox';

    // Verify the tenant exists
    const tenant = await withRetry(() =>
      db.tenant.findUnique({
        where: { id },
        select: { id: true, name: true },
      })
    );

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'School not found' } },
        { status: 404 }
      );
    }

    // Encrypt sensitive credentials
    const encryptionKey = getEncryptionKey();
    const consumerSecretEncrypted = encrypt(consumerSecret, encryptionKey);
    const passkeyEncrypted = encrypt(passkey, encryptionKey);

    // Upsert the M-Pesa config
    const config = await withRetry(() =>
      db.schoolMpesaConfig.upsert({
        where: { tenantId: id },
        create: {
          tenantId: id,
          consumerKey,
          consumerSecretEncrypted,
          passkeyEncrypted,
          shortcode,
          tillNumber: tillNumber || null,
          environment: envValue,
          isActive: true,
          configuredById: admin.userId,
        },
        update: {
          consumerKey,
          consumerSecretEncrypted,
          passkeyEncrypted,
          shortcode,
          tillNumber: tillNumber || null,
          environment: envValue,
          isActive: true,
          configuredById: admin.userId,
        },
      })
    );

    // Enable M-Pesa STK for this tenant
    await withRetry(() =>
      db.tenant.update({
        where: { id },
        data: { mpesaStkEnabled: true },
      })
    );

    // Audit log
    await withRetry(() =>
      db.auditLog.create({
        data: {
          action: 'mpesa_config_updated',
          entityType: 'tenant',
          entityId: id,
          details: JSON.stringify({
            shortcode: maskSecret(shortcode),
            environment: envValue,
            tillNumber: tillNumber ? maskSecret(tillNumber) : null,
          }),
          actorId: admin.userId,
          actorType: 'global_user',
        },
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        shortcode: config.shortcode,
        environment: config.environment,
        mpesaStkEnabled: true,
      },
    });
  } catch (error: unknown) {
    console.error('[M-Pesa Config PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/schools/[id]/mpesa-config
 *
 * Remove a school's M-Pesa configuration and disable M-Pesa STK.
 * Requires admin authentication.
 */
export async function DELETE(
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

    // Verify the tenant exists
    const tenant = await withRetry(() =>
      db.tenant.findUnique({
        where: { id },
        select: { id: true, name: true },
      })
    );

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'School not found' } },
        { status: 404 }
      );
    }

    // Delete the M-Pesa config (cascading from schema)
    await withRetry(() =>
      db.schoolMpesaConfig.deleteMany({
        where: { tenantId: id },
      })
    );

    // Disable M-Pesa STK for this tenant
    await withRetry(() =>
      db.tenant.update({
        where: { id },
        data: { mpesaStkEnabled: false },
      })
    );

    // Audit log
    await withRetry(() =>
      db.auditLog.create({
        data: {
          action: 'mpesa_config_deleted',
          entityType: 'tenant',
          entityId: id,
          details: JSON.stringify({ schoolName: tenant.name }),
          actorId: admin.userId,
          actorType: 'global_user',
        },
      })
    );

    return NextResponse.json({
      success: true,
      data: { message: 'M-Pesa configuration removed and STK disabled' },
    });
  } catch (error: unknown) {
    console.error('[M-Pesa Config DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
