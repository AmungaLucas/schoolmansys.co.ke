import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Build a MySQL connection URL with timeout and pool params for unreliable hosts.
 * Appends connect_timeout=10&connection_limit=5 to the DATABASE_URL.
 */
function buildDbUrl(): string {
  const base = process.env.DATABASE_URL || '';
  if (!base.startsWith('mysql')) return base;
  try {
    const url = new URL(base);
    // Set MySQL connection timeout to 10s (default is often 60s)
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '10');
    }
    return url.toString();
  } catch {
    return base;
  }
}

/**
 * Prisma Client with connection pool settings optimized for:
 * - Vercel serverless (short-lived functions, need low pool count)
 * - Shared hosting (limited connections)
 * - Connection timeout to prevent hanging requests
 * - Unreliable remote MySQL hosts (connect_timeout=10s)
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: buildDbUrl(),
      },
    },
  })

// In production (Vercel), always reuse the singleton to avoid connection exhaustion
// In development, reuse to prevent hot-reload from creating multiple instances
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}

/**
 * Execute a Prisma operation with retry logic for intermittent connection failures.
 * Retries up to `maxRetries` times with a 1s delay between attempts.
 * Only retries on Prisma connection errors (P1001, P1008).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      // Only retry on connection errors
      const isConnectionError =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P1001', 'P1008'].includes((error as { code: string }).code);
      if (isConnectionError && attempt < maxRetries) {
        console.warn(`[DB] Connection failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}
