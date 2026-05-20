/**
 * Prisma Client Singleton
 * Ensures only one instance is created per process (important for Passenger).
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

// In development, prevent hot-reloading from creating multiple instances
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });
}

module.exports = globalForPrisma.prisma;
