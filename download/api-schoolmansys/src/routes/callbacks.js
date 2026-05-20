/**
 * M-Pesa Daraja STK Push Callback Route
 *
 * Called by Safaricom when an STK Push payment completes (success, fail, or cancel).
 *
 * Flow:
 * 1. Parse the callback body from Daraja
 * 2. Look up the pending MpesaTransaction by CheckoutRequestID
 * 3. If successful (ResultCode === 0):
 *    a. Create a FeePayment record
 *    b. Atomically decrement the student's fee balance
 *    c. Update the MpesaTransaction as success
 * 4. If failed/cancelled: Update the MpesaTransaction status
 * 5. Return 200 to Daraja immediately (they don't retry on 200)
 */

const express = require('express');
const db = require('../lib/db');
const { parseCallback } = require('../lib/mpesa');

const router = express.Router();

/**
 * POST /callbacks/mpesa
 * Safaricom calls this endpoint with the STK Push result.
 */
router.post('/mpesa', async (req, res) => {
  try {
    const body = req.body;
    const parsed = parseCallback(body);

    console.log(
      `[M-Pesa Callback] CheckoutRequestID: ${parsed.checkoutRequestId}, ` +
      `ResultCode: ${parsed.resultCode}, ResultDesc: ${parsed.resultDesc}`
    );

    // Look up the pending transaction
    let mpesaTx;
    try {
      mpesaTx = await db.mpesaTransaction.findUnique({
        where: { checkoutRequestId: parsed.checkoutRequestId },
      });
    } catch (dbErr) {
      console.error('[M-Pesa Callback] Database error finding transaction:', dbErr.message);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted (db error)' });
    }

    if (!mpesaTx) {
      console.error(
        `[M-Pesa Callback] No transaction found for CheckoutRequestID: ${parsed.checkoutRequestId}`
      );
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted (no matching transaction)' });
    }

    if (mpesaTx.status !== 'pending') {
      console.log(
        `[M-Pesa Callback] Transaction ${mpesaTx.id} already processed (status: ${mpesaTx.status}). Skipping.`
      );
      return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
    }

    if (parsed.success) {
      // === SUCCESSFUL PAYMENT ===
      // Use interactive transaction for atomic fee balance update
      const result = await db.$transaction(async (tx) => {
        // Find the student
        const student = await tx.student.findFirst({
          where: { 
            id: mpesaTx.studentId, 
            tenantId: mpesaTx.tenantId, 
            deletedAt: null 
          },
        });

        if (!student) {
          throw new Error('STUDENT_NOT_FOUND');
        }

        // Generate receipt number
        const receiptNumber = parsed.mpesaReceiptNumber || 
          `MPS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Create the fee payment record
        const feePayment = await tx.feePayment.create({
          data: {
            tenantId: mpesaTx.tenantId,
            studentId: mpesaTx.studentId,
            feeStructureId: mpesaTx.feeStructureId,
            amount: parsed.amount || mpesaTx.amount,
            method: 'mpesa',
            reference: parsed.mpesaReceiptNumber || null,
            receiptNumber,
            payeeName: `M-Pesa ${parsed.phoneNumber || ''}`.trim() || null,
            collectedBy: null, // Automated
            status: 'success',
          },
        });

        // Atomically update the student fee balance
        const newBalance = Math.max(
          0, 
          student.currentFeeBalance - (parsed.amount || mpesaTx.amount)
        );
        await tx.student.update({
          where: { id: mpesaTx.studentId },
          data: { 
            currentFeeBalance: { decrement: parsed.amount || mpesaTx.amount } 
          },
        });

        // Update M-Pesa transaction record
        await tx.mpesaTransaction.update({
          where: { id: mpesaTx.id },
          data: {
            status: 'success',
            mpesaReceipt: parsed.mpesaReceiptNumber || null,
            resultDesc: parsed.resultDesc,
            feePaymentId: feePayment.id,
          },
        });

        return { feePayment, newBalance };
      });

      console.log(
        `[M-Pesa Callback] Payment SUCCESS: ${parsed.mpesaReceiptNumber}, ` +
        `Amount: KES ${parsed.amount}, Student: ${mpesaTx.studentId}, ` +
        `New Balance: KES ${result.newBalance}`
      );

    } else {
      // === FAILED / CANCELLED PAYMENT ===
      await db.mpesaTransaction.update({
        where: { id: mpesaTx.id },
        data: {
          status: parsed.resultCode === 1032 ? 'cancelled' : 'failed',
          resultDesc: parsed.resultDesc,
        },
      });

      console.log(
        `[M-Pesa Callback] Payment ${parsed.resultCode === 1032 ? 'CANCELLED' : 'FAILED'}: ` +
        `${parsed.resultDesc} (Code: ${parsed.resultCode})`
      );
    }

    // Always return 200 to Daraja to acknowledge receipt
    return res.json({ ResultCode: 0, ResultDesc: 'Callback accepted' });

  } catch (error) {
    console.error('[M-Pesa Callback] Error processing callback:', error.message);
    // Return 200 to prevent retries even on errors
    return res.json({ ResultCode: 0, ResultDesc: 'Callback logged for review' });
  }
});

/**
 * GET /callbacks/mpesa
 * Health check endpoint for M-Pesa callback path.
 * Safaricom or monitoring tools can use this to verify the endpoint is alive.
 */
router.get('/mpesa', (req, res) => {
  res.json({
    success: true,
    service: 'SchoolManSys M-Pesa Callback API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

module.exports = router;
