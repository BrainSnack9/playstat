import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// 프로세스 종료 시 커넥션 정리 (idle in transaction 방지)
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    await prisma.$disconnect()
  }
  process.on('beforeExit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
