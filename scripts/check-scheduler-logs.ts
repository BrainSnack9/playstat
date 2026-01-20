import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const logs = await prisma.schedulerLog.findMany({
    where: { jobName: { contains: 'analysis' } },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  for (const log of logs) {
    console.log('---')
    console.log('Time:', log.createdAt.toISOString())
    console.log('Job:', log.jobName)
    console.log('Result:', log.result)
    console.log('Details:', log.details)
  }
  await prisma.$disconnect()
}
check()
