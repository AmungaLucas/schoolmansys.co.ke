import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma Client with connection pool settings optimized for:
 * - Vercel serverless (short-lived functions, need low pool count)
 * - Shared hosting (limited connections)
 * - Connection timeout to prevent hanging requests
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool settings for serverless
    // Vercel serverless functions are short-lived; use fewer connections
    ...(process.env.DATABASE_URL?.startsWith('mysql') ? {
      // @ts-expect-error - Prisma supports these for MySQL
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    } : {}),
  })

// In production (Vercel), always reuse the singleton to avoid connection exhaustion
// In development, reuse to prevent hot-reload from creating multiple instances
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
