/**
 * M-Pesa Daraja Callback Parser
 * Shared utility for parsing STK Push callback bodies from Safaricom.
 */

/**
 * Parse the raw M-Pesa callback body into a usable structure.
 *
 * Expected body format from Safaricom:
 * {
 *   "Body": {
 *     "stkCallback": {
 *       "MerchantRequestID": "...",
 *       "CheckoutRequestID": "...",
 *       "ResultCode": 0,
 *       "ResultDesc": "...",
 *       "CallbackMetadata": {
 *         "Item": [
 *           { "Name": "MpesaReceiptNumber", "Value": "..." },
 *           { "Name": "Amount", "Value": 1000 },
 *           { "Name": "PhoneNumber", "Value": "254..." },
 *           { "Name": "TransactionDate", "Value": 20240101120000 }
 *         ]
 *       }
 *     }
 *   }
 * }
 */
function parseCallback(body) {
  const stk = body?.Body?.stkCallback;
  if (!stk) {
    throw new Error('Invalid M-Pesa callback body: missing Body.stkCallback');
  }

  const result = {
    success: stk.ResultCode === 0,
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
    resultCode: stk.ResultCode,
    resultDesc: stk.ResultDesc,
    mpesaReceiptNumber: undefined,
    amount: undefined,
    phoneNumber: undefined,
    transactionDate: undefined,
  };

  if (stk.CallbackMetadata?.Item) {
    for (const item of stk.CallbackMetadata.Item) {
      switch (item.Name) {
        case 'MpesaReceiptNumber':
          result.mpesaReceiptNumber = String(item.Value);
          break;
        case 'Amount':
          result.amount = Number(item.Value);
          break;
        case 'PhoneNumber':
          result.phoneNumber = String(item.Value);
          break;
        case 'TransactionDate':
          result.transactionDate = String(item.Value);
          break;
      }
    }
  }

  return result;
}

module.exports = { parseCallback };
