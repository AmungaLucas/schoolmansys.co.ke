import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth-guard";
import { initiateSTKPush, generateCheckoutRef } from "@/lib/mpesa";

/**
 * POST /api/school/[tenantId]/fees/mpesa-initiate
 *
 * Initiates an M-Pesa STK Push payment for a student's fee.
 *
 * Body:
 *   - studentId: string (required)
 *   - amount: number (required, KES)
 *   - phoneNumber: string (required, e.g., "0712345678" or "254712345678")
 *   - feeStructureId?: string (optional)
 *
 * Flow:
 * 1. Verify school user authentication
 * 2. Validate input (amount, phone format)
 * 3. Look up student and verify they belong to this tenant
 * 4. Create a pending MpesaTransaction record
 * 5. Initiate STK Push via Daraja API
 * 6. Return checkout info for polling/tracking
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
    const student = await db.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        currentFeeBalance: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Student not found" } },
        { status: 404 }
      );
    }

    // Check for any existing pending M-Pesa transaction for this student
    const existingPending = await db.mpesaTransaction.findFirst({
      where: {
        studentId,
        tenantId,
        status: "pending",
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Within last 5 minutes
      },
    });

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

    // Initiate STK Push
    const accountReference = `SCH-${student.admissionNumber}`;
    const transactionDesc = `Fee: ${student.firstName} ${student.lastName}`;

    const stkResult = await initiateSTKPush({
      phoneNumber,
      amount: numAmount,
      accountReference,
      transactionDesc,
    });

    if (!stkResult.success || !stkResult.checkoutRequestId) {
      // Still create a failed record for audit trail
      if (stkResult.checkoutRequestId) {
        await db.mpesaTransaction.create({
          data: {
            tenantId,
            studentId,
            feeStructureId: feeStructureId || null,
            checkoutRequestId: stkResult.checkoutRequestId,
            merchantRequestId: stkResult.merchantRequestId || null,
            phoneNumber,
            amount: numAmount,
            accountReference,
            status: "failed",
            resultDesc: stkResult.error || stkResult.responseDescription || "STK Push initiation failed",
          },
        });
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
    const mpesaTx = await db.mpesaTransaction.create({
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
    });

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
    const transactions = await db.mpesaTransaction.findMany({
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
    });

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
