/**
 * M-Pesa Daraja STK Push Integration
 *
 * Supports both sandbox and production environments.
 * Uses Daraja API v1 for STK Push initiation and callback handling.
 *
 * Constraints respected:
 * - No background workers (callback is handled synchronously)
 * - Pessimistic locking for fee balance updates (handled at record-payment level)
 * - Standard API envelopes for all responses
 */

const DARAJA_BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

interface OAuthToken {
  access_token: string;
  expires_in: string;
}

let cachedToken: OAuthToken | null = null;
let tokenExpiry = 0;

/**
 * Get the Daraja base URL based on environment configuration.
 */
function getBaseUrl(): string {
  const env = process.env.MPESA_ENVIRONMENT || 'sandbox';
  return DARAJA_BASE_URLS[env as keyof typeof DARAJA_BASE_URLS] || DARAJA_BASE_URLS.sandbox;
}

/**
 * Get the M-Pesa consumer credentials from environment.
 */
function getCredentials(): { consumerKey: string; consumerSecret: string } {
  const consumerKey = process.env.MPESA_CONSUMER_KEY || '';
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.');
  }
  return { consumerKey, consumerSecret };
}

/**
 * Generate OAuth access token from Daraja API.
 * Tokens are cached for 50 minutes (actual expiry is 60 minutes).
 */
export async function getOAuthToken(): Promise<string> {
  // Return cached token if still valid (refresh 10 minutes before expiry)
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken.access_token;
  }

  const { consumerKey, consumerSecret } = getCredentials();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const response = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
    timeout: 10000, // 10 second timeout
  } as RequestInit);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get M-Pesa OAuth token: ${response.status} - ${text}`);
  }

  cachedToken = await response.json();
  tokenExpiry = Date.now() + (parseInt(cachedToken.expires_in, 10) - 600) * 1000; // Refresh 10 min before expiry

  return cachedToken.access_token;
}

/**
 * STK Push initiation parameters.
 */
export interface STKPushRequest {
  /** Phone number in format 254XXXXXXXXX */
  phoneNumber: string;
  /** Amount in KES (minimum 1) */
  amount: number;
  /** Unique reference for this transaction (e.g., receipt number) */
  accountReference: string;
  /** Description shown to the user on their phone */
  transactionDesc: string;
}

/**
 * STK Push response from Daraja API.
 */
export interface STKPushResponse {
  success: boolean;
  /** Daraja CheckoutRequestID for tracking */
  checkoutRequestId?: string;
  /** Daraja MerchantRequestID */
  merchantRequestId?: string;
  /** Daraja ResponseCode */
  responseCode?: string;
  /** Daraja ResponseDescription */
  responseDescription?: string;
  /** Customer message (e.g., "Accept the request...") */
  customerMessage?: string;
  /** Error details if failed */
  error?: string;
}

/**
 * Initiate an M-Pesa STK Push (Lipa Na M-Pesa Online).
 *
 * This sends a prompt to the customer's phone to authorize the payment.
 * The actual payment result arrives via the callback endpoint.
 */
export async function initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse> {
  try {
    const accessToken = await getOAuthToken();
    const shortcode = process.env.MPESA_SHORTCODE || '';
    const passkey = process.env.MPESA_PASSKEY || '';
    const tillNumber = process.env.MPESA_PARTY_B || '';

    if (!shortcode || !passkey) {
      throw new Error('MPESA_SHORTCODE and MPESA_PASSKEY must be configured.');
    }

    // Normalize phone number: remove leading 0 or +254
    let phone = request.phoneNumber.replace(/\s/g, '');
    if (phone.startsWith('+')) phone = phone.substring(1);
    if (phone.startsWith('0')) phone = `254${phone.substring(1)}`;
    if (!phone.startsWith('254') || phone.length !== 12) {
      return {
        success: false,
        error: `Invalid phone number format. Expected 254XXXXXXXXX, got ${phone}`,
      };
    }

    if (request.amount < 1) {
      return {
        success: false,
        error: 'Amount must be at least KES 1.',
      };
    }

    // Determine TransactionType and PartyB based on whether a Till Number is configured.
    // Till Number (Buy Goods): CustomerBuyGoodsOnline, PartyB = till number
    // Paybill (no till): CustomerPayBillOnline, PartyB = shortcode
    const isTill = !!tillNumber;
    const transactionType = isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
    const partyB = isTill ? tillNumber : shortcode;

    // Generate password: Base64(Shortcode + Passkey + Timestamp)
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const body = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: Math.round(request.amount),
      PartyA: phone,
      PartyB: partyB,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL || '',
      AccountReference: request.accountReference.substring(0, 12),
      TransactionDesc: request.transactionDesc.substring(0, 13),
    };

    const response = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    } as RequestInit);

    const data = await response.json();

    if (data.ResponseCode === '0') {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage,
      };
    }

    return {
      success: false,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage,
      error: data.ResponseDescription || `M-Pesa error: ${data.ResponseCode}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown M-Pesa error';
    console.error('[M-Pesa] STK Push initiation failed:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * M-Pesa C2B callback body structure (from Daraja).
 */
export interface MpesaCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: number | string;
        }>;
      };
    };
  };
}

/**
 * Parsed callback data for application use.
 */
export interface ParsedCallback {
  success: boolean;
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDesc: string;
  /** M-Pesa receipt number (only on success) */
  mpesaReceiptNumber?: string;
  /** Amount paid in KES (only on success) */
  amount?: number;
  /** Phone number that paid (only on success) */
  phoneNumber?: string;
  /** Transaction date/time (only on success) */
  transactionDate?: string;
  /** Transaction reference (Balance Account) */
  reference?: string;
}

/**
 * Parse the raw M-Pesa callback body into a usable structure.
 */
export function parseCallback(body: MpesaCallbackBody): ParsedCallback {
  const stk = body.Body.stkCallback;

  const result: ParsedCallback = {
    success: stk.ResultCode === 0,
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
    resultCode: stk.ResultCode,
    resultDesc: stk.ResultDesc,
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
        case 'Reference':
          result.reference = String(item.Value);
          break;
      }
    }
  }

  return result;
}

/**
 * Get Daraja base URL for a specific environment.
 */
function getBaseUrlForEnv(environment: string): string {
  return DARAJA_BASE_URLS[environment as keyof typeof DARAJA_BASE_URLS] || DARAJA_BASE_URLS.sandbox;
}

/**
 * Get OAuth access token using custom school credentials (not cached).
 * Each call makes a fresh request to Daraja — no global caching.
 *
 * @param consumerKey - School's Daraja consumer key
 * @param consumerSecret - School's Daraja consumer secret
 * @param environment - 'sandbox' or 'production'
 */
export async function getSchoolOAuthToken(
  consumerKey: string,
  consumerSecret: string,
  environment: string
): Promise<string> {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const baseUrl = getBaseUrlForEnv(environment);

  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  } as RequestInit);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get school M-Pesa OAuth token: ${response.status} - ${text}`);
  }

  const data = await response.json() as OAuthToken;
  return data.access_token;
}

/**
 * Configuration for school-specific STK Push.
 */
export interface SchoolSTKPushConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  tillNumber?: string;
  environment: string;
  callbackUrl: string;
}

/**
 * Initiate an M-Pesa STK Push using a school's own Daraja credentials.
 *
 * Similar to initiateSTKPush but uses the provided config instead of env vars.
 * Used when per-school M-Pesa configuration is enabled.
 *
 * @param request - Standard STK Push request parameters
 * @param config - School's M-Pesa credentials and configuration
 */
export async function initiateSchoolSTKPush(
  request: STKPushRequest,
  config: SchoolSTKPushConfig
): Promise<STKPushResponse> {
  try {
    const accessToken = await getSchoolOAuthToken(
      config.consumerKey,
      config.consumerSecret,
      config.environment
    );

    // Determine TransactionType and PartyB based on whether a Till Number is configured.
    // Till Number (Buy Goods): CustomerBuyGoodsOnline, PartyB = till number
    // Paybill (no till): CustomerPayBillOnline, PartyB = shortcode
    const isTill = !!config.tillNumber;
    const transactionType = isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
    const partyB = isTill ? config.tillNumber! : config.shortcode;

    // Normalize phone number: remove leading 0 or +254
    let phone = request.phoneNumber.replace(/\s/g, '');
    if (phone.startsWith('+')) phone = phone.substring(1);
    if (phone.startsWith('0')) phone = `254${phone.substring(1)}`;
    if (!phone.startsWith('254') || phone.length !== 12) {
      return {
        success: false,
        error: `Invalid phone number format. Expected 254XXXXXXXXX, got ${phone}`,
      };
    }

    if (request.amount < 1) {
      return {
        success: false,
        error: 'Amount must be at least KES 1.',
      };
    }

    // Generate password: Base64(Shortcode + Passkey + Timestamp)
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
    const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');

    const baseUrl = getBaseUrlForEnv(config.environment);

    const body = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: Math.round(request.amount),
      PartyA: phone,
      PartyB: partyB,
      PhoneNumber: phone,
      CallBackURL: config.callbackUrl,
      AccountReference: request.accountReference.substring(0, 12),
      TransactionDesc: request.transactionDesc.substring(0, 13),
    };

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    } as RequestInit);

    const data = await response.json();

    if (data.ResponseCode === '0') {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage,
      };
    }

    return {
      success: false,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage,
      error: data.ResponseDescription || `M-Pesa error: ${data.ResponseCode}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown M-Pesa error';
    console.error('[M-Pesa] School STK Push initiation failed:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Generate a unique CheckoutRequestID for tracking pending STK Push requests.
 */
export function generateCheckoutRef(): string {
  return `CHK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}
