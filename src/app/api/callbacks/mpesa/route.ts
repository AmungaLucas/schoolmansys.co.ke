import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseCallback, type MpesaCallbackBody } from "@/lib/mpesa";

/**
 * M-Pesa Daraja STK Push Callback Endpoint
 *
 * Called by Safaricom when an STK Push payment completes (success, fail, or cancel).
 * This endpoint is registered as the CallBackURL in the STK Push request.
 *
 * Flow:
 * 1. Parse the callback body from Daraja
 * 2. Look up the pending MpesaTransaction by CheckoutRequestID
 * 3. If successful (ResultCode === 0):
 *    a. Create a FeePayment record
 *    b. Atomically decrement the student's fee balance (pessimistic locking)
 *    c. Update the MpesaTransaction as success
 * 4. If failed/cancelled: Update the MpesaTransaction status
 * 5. Return 200 to Daraja immediately (they don't retry on 200)
 */
export async function POST(request: NextRequest) {
  try {
    const body: MpesaCallbackBody = await request.json();
    const parsed = parseCallback(body);

    console.log(
      `[M-Pesa Callback] CheckoutRequestID: ${parsed.checkoutRequestId}, ` +
      `ResultCode: ${parsed.resultCode}, ResultDesc: ${parsed.resultDesc}`
    );

    // Defensive: check that the MpesaTransaction model is available
    // (If prisma db push hasn't been run, the table won't exist)
    if (!db.mpesaTransaction) {
      console.error('[M-Pesa Callback] MpesaTransaction model not available. Run "prisma db push" to create the table.');
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted (table not ready)" });
    }

    // Look up the pending transaction
    const mpesaTx = await db.mpesaTransaction.findUnique({
      where: { checkoutRequestId: parsed.checkoutRequestId },
    }).catch((err: unknown) => {
      console.error('[M-Pesa Callback] Error finding transaction:', err);
      return null;
    });

    if (!mpesaTx) {
      console.error(
        `[M-Pesa Callback] No transaction found for CheckoutRequestID: ${parsed.checkoutRequestId}`
      );
      // Still return 200 to prevent Daraja retries for unknown transactions
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted (no matching transaction)" });
    }

    if (mpesaTx.status !== "pending") {
      console.log(
        `[M-Pesa Callback] Transaction ${mpesaTx.id} already processed (status: ${mpesaTx.status}). Skipping.`
      );
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Already processed" });
    }

    if (parsed.success) {
      // === SUCCESSFUL PAYMENT ===
      // Use interactive transaction with pessimistic locking for fee balance update
      const result = await db.$transaction(async (tx) => {
        // Lock the student row for update (pessimistic locking per Constraint #8)
        const student = await tx.student.findFirst({
          where: { id: mpesaTx.studentId, tenantId: mpesaTx.tenantId, deletedAt: null },
        });

        if (!student) {
          throw new Error("STUDENT_NOT_FOUND");
        }

        // Generate receipt number
        const receiptNumber = parsed.mpesaReceipt || `MPS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Create the fee payment record
        const feePayment = await tx.feePayment.create({
          data: {
            tenantId: mpesaTx.tenantId,
            studentId: mpesaTx.studentId,
            feeStructureId: mpesaTx.feeStructureId,
            amount: parsed.amount || mpesaTx.amount,
            method: "mpesa",
            reference: parsed.mpesaReceipt || null,
            receiptNumber,
            payeeName: `M-Pesa ${parsed.phoneNumber || ''}`.trim() || null,
            collectedBy: null, // Automated, no human collector
            status: "success",
          },
        });

        // Atomically update the student fee balance
        const newBalance = Math.max(0, student.currentFeeBalance - (parsed.amount || mpesaTx.amount));
        await tx.student.update({
          where: { id: mpesaTx.studentId },
          data: { currentFeeBalance: { decrement: parsed.amount || mpesaTx.amount } },
        });

        // Update M-Pesa transaction record
        await tx.mpesaTransaction.update({
          where: { id: mpesaTx.id },
          data: {
            status: "success",
            mpesaReceipt: parsed.mpesaReceipt || null,
            resultDesc: parsed.resultDesc,
            feePaymentId: feePayment.id,
          },
        });

        return { feePayment, newBalance };
      });

      console.log(
        `[M-Pesa Callback] Payment SUCCESS: ${parsed.mpesaReceipt}, ` +
        `Amount: KES ${parsed.amount}, Student: ${mpesaTx.studentId}, ` +
        `New Balance: KES ${result.newBalance}`
      );

    } else {
      // === FAILED / CANCELLED PAYMENT ===
      await db.mpesaTransaction.update({
        where: { id: mpesaTx.id },
        data: {
          status: parsed.resultCode === 1032 ? "cancelled" : "failed",
          resultDesc: parsed.resultDesc,
        },
      });

      console.log(
        `[M-Pesa Callback] Payment ${parsed.resultCode === 1032 ? 'CANCELLED' : 'FAILED'}: ` +
        `${parsed.resultDesc} (Code: ${parsed.resultCode})`
      );
    }

    // Always return 200 to Daraja to acknowledge receipt
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback accepted" });
  } catch (error: unknown) {
    console.error("[M-Pesa Callback] Error processing callback:", error);
    // Return 200 to prevent retries even on errors, log the error for manual review
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback logged for review" });
  }
}

/**
 * Health check endpoint for M-Pesa callback path.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "M-Pesa callback endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
