/**
 * AES-256-GCM Encryption Utility for M-Pesa Credentials
 *
 * Encrypts sensitive values (consumer secret, passkey) before storing in DB.
 * Each encrypted value uses a random 12-byte IV + 16-byte auth tag,
 * all concatenated and base64 encoded.
 *
 * Format: base64(iv[12] + ciphertext + authTag[16])
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the master encryption key from environment.
 * Must be a 32-byte (64 hex char) string for AES-256.
 * @throws Error if not configured or invalid length
 */
export function getEncryptionKey(): string {
  const key = process.env.MPESA_ENCRYPTION_KEY || '';
  if (!key) {
    throw new Error(
      'MPESA_ENCRYPTION_KEY is not set. Generate a 32-byte hex key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  // Key must be exactly 64 hex characters (32 bytes)
  if (key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'MPESA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      `Got ${key.length} characters.`
    );
  }
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param masterKey - 64-char hex string (32 bytes) encryption key
 * @returns Base64-encoded string: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string, masterKey: string): string {
  const key = Buffer.from(masterKey, 'hex');
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Concatenate: iv + encrypted ciphertext + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);

  return combined.toString('base64');
}

/**
 * Decrypt a value that was encrypted with the encrypt() function.
 *
 * @param encrypted - Base64 string from encrypt()
 * @param masterKey - 64-char hex string (32 bytes) encryption key
 * @returns The original plaintext string
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 */
export function decrypt(encrypted: string, masterKey: string): string {
  const key = Buffer.from(masterKey, 'hex');
  const combined = Buffer.from(encrypted, 'base64');

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Mask a secret value for display purposes.
 * Shows the first `visibleChars` characters followed by asterisks.
 *
 * @param value - The value to mask
 * @param visibleChars - How many leading characters to show (default: 6)
 * @returns Masked string like "abc123****"
 */
export function maskSecret(value: string, visibleChars = 6): string {
  if (!value || value.length <= visibleChars) {
    return '****';
  }
  return value.substring(0, visibleChars) + '****';
}
