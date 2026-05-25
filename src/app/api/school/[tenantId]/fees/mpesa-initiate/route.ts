import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth-guard";
import { initiateSchoolSTKPush, type SchoolSTKPushConfig } from "@/lib/mpesa";
import { decrypt, getEncryptionKey } from "@/lib/crypto";

/**
 * POST /api/school/[tenantId]/fees/mpesa-initiate
 *
 * Initiates an M-Pesa STK Push payment for a student's fee.
 * Uses the school's own M-Pesa credentials if configured and enabled.
 *
 * Body:
 *   - studentId: string (required)
 *   - amount: number (required, KES)
 *   - phoneNumber: string (required, e.g., "0712345678" or "254712345678")
 *   - feeStructureId?: string (optional)
 *
 * Flow:
 * 1. Verify school user authentication
 * 2. Check tenant has M-Pesa config and is enabled
 * 3. Validate input (amount, phone format)
 * 4. Look up student and verify they belong to this tenant
 * 5. Decrypt school's M-Pesa credentials
 * 6. Create a pending MpesaTransaction record
 * 7. Initiate STK Push via Daraja API using school credentials
 * 8. Return checkout info for polling/tracking
 */
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

    // ---- Per-school M-Pesa config check ----
    // Load tenant with mpesaStkEnabled flag and schoolMpesaConfig
    const tenantWithConfig = await withRetry(() =>
      db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          mpesaStkEnabled: true,
          schoolMpesaConfig: {
            select: {
              id: true,
              consumerKey: true,
              consumerSecretEncrypted: true,
              passkeyEncrypted: true,
              shortcode: true,
              tillNumber: true,
              environment: true,
              isActive: true,
            },
          },
        },
      })
    );

    if (!tenantWithConfig || !tenantWithConfig.schoolMpesaConfig) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MPESA_NOT_CONFIGURED",
            message: "M-Pesa is not enabled for this school. Contact your administrator.",
          },
        },
        { status: 403 }
      );
    }

    if (!tenantWithConfig.mpesaStkEnabled || !tenantWithConfig.schoolMpesaConfig.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MPESA_NOT_CONFIGURED",
            message: "M-Pesa is not enabled for this school. Contact your administrator.",
          },
        },
        { status: 403 }
      );
    }

    const mpesaConfig = tenantWithConfig.schoolMpesaConfig;

    // Decrypt credentials
    let consumerSecret: string;
    let passkey: string;
    try {
      const encryptionKey = getEncryptionKey();
      consumerSecret = decrypt(mpesaConfig.consumerSecretEncrypted, encryptionKey);
      passkey = decrypt(mpesaConfig.passkeyEncrypted, encryptionKey);
    } catch {
      console.error("[M-Pesa Initiate] Failed to decrypt school M-Pesa credentials");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MPESA_CONFIG_ERROR",
            message: "M-Pesa configuration error. Contact your administrator.",
          },
        },
        { status: 500 }
      );
    }

    // Build the school-specific STK Push config
    const schoolMpesaConfig: SchoolSTKPushConfig = {
      consumerKey: mpesaConfig.consumerKey,
      consumerSecret,
      passkey,
      shortcode: mpesaConfig.shortcode,
      tillNumber: mpesaConfig.tillNumber || undefined,
      environment: mpesaConfig.environment,
      callbackUrl: process.env.MPESA_CALLBACK_URL || "",
    };

    const body = await request.json();
    const { studentId, amount, phoneNumber, feeStructureId } = body;

    // Validate required fields
    if (!studentId || !amount || !phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "studentId, amount, and phoneNumber are required",
          },
        },
        { status: 400 }
      );
    }

    // Validate amount
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Amount must be at least KES 1" },
        },
        { status: 400 }
      );
    }

    if (numAmount > 150000) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "M-Pesa STK Push limit is KES 150,000 per transaction" },
        },
        { status: 400 }
      );
    }

    // Verify student exists and belongs to this tenant
    const student = await withRetry(() =>
      db.student.findFirst({
        where: { id: studentId, tenantId, deletedAt: null },
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          currentFeeBalance: true,
        },
      })
    );

    if (!student) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Student not found" } },
        { status: 404 }
      );
    }

    // Check for any existing pending M-Pesa transaction for this student
    const existingPending = await withRetry(() =>
      db.mpesaTransaction.findFirst({
        where: {
          studentId,
          tenantId,
          status: "pending",
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Within last 5 minutes
        },
      })
    );

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_REQUEST",
            message: "An M-Pesa payment request is already pending for this student. Please wait for it to complete or expire.",
          },
        },
        { status: 409 }
      );
    }

    // Initiate STK Push using school's credentials
    const accountReference = `SCH-${student.admissionNumber}`;
    const transactionDesc = `Fee: ${student.firstName} ${student.lastName}`;

    const stkResult = await initiateSchoolSTKPush(
      {
        phoneNumber,
        amount: numAmount,
        accountReference,
        transactionDesc,
      },
      schoolMpesaConfig
    );

    if (!stkResult.success || !stkResult.checkoutRequestId) {
      // Still create a failed record for audit trail
      if (stkResult.checkoutRequestId) {
        await withRetry(() =>
          db.mpesaTransaction.create({
            data: {
              tenantId,
              studentId,
              feeStructureId: feeStructureId || null,
              checkoutRequestId: stkResult.checkoutRequestId!,
              merchantRequestId: stkResult.merchantRequestId || null,
              phoneNumber,
              amount: numAmount,
              accountReference,
              status: "failed",
              resultDesc: stkResult.error || stkResult.responseDescription || "STK Push initiation failed",
            },
          })
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MPESA_ERROR",
            message: stkResult.error || stkResult.responseDescription || "Failed to initiate M-Pesa payment",
          },
        },
        { status: 400 }
      );
    }

    // Create the pending M-Pesa transaction record
    const mpesaTx = await withRetry(() =>
      db.mpesaTransaction.create({
        data: {
          tenantId,
          studentId,
          feeStructureId: feeStructureId || null,
          checkoutRequestId: stkResult.checkoutRequestId!,
          merchantRequestId: stkResult.merchantRequestId || null,
          phoneNumber,
          amount: numAmount,
          accountReference,
          status: "pending",
          resultDesc: stkResult.customerMessage || "STK Push sent, awaiting response",
        },
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        transactionId: mpesaTx.id,
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        amount: numAmount,
        phoneNumber,
        status: "pending",
        message: stkResult.customerMessage || "M-Pesa payment prompt sent. Please check your phone.",
      },
    });
  } catch (error: unknown) {
    console.error("[M-Pesa Initiate] Error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/school/[tenantId]/fees/mpesa-initiate?studentId=xxx
 *
 * Check the status of pending/recent M-Pesa transactions for a student.
 */
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
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "studentId query parameter is required" } },
        { status: 400 }
      );
    }

    // Get recent transactions for this student (last 24 hours)
    const transactions = await withRetry(() =>
      db.mpesaTransaction.findMany({
        where: {
          studentId,
          tenantId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          phoneNumber: true,
          status: true,
          mpesaReceipt: true,
          resultDesc: true,
          accountReference: true,
          createdAt: true,
        },
      })
    );

    // Get the latest pending one specifically
    const pending = transactions.find((t) => t.status === "pending");

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        hasPending: !!pending,
        pendingTransaction: pending || null,
      },
    });
  } catch (error: unknown) {
    console.error("[M-Pesa Status] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to check M-Pesa status" } },
      { status: 500 }
    );
  }
}
