import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Deleting all basketball daily reports...')

  const result = await prisma.dailyReport.deleteMany({
    where: {
      sportType: 'BASKETBALL'
    }
  })

  console.log(`Deleted ${result.count} basketball daily reports`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
