import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// 💡 Вместо краша сборки просто выводим предупреждение в консоль, если переменной нет во время билда
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️ DATABASE_URL is not set. Database operations will fail at runtime.');
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;