import { PrismaClient } from '@prisma/client'
import { getUTCDayRange } from '../src/lib/timezone'
import { format } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  const { start, end, utcDate } = getUTCDayRange('2026-01-19')

  console.log('Checking basketball matches for 2026-01-19 (UTC)')
  console.log('UTC Date:', format(utcDate, 'yyyy-MM-dd HH:mm:ss'))
  console.log('Start:', format(start, 'yyyy-MM-dd HH:mm:ss'))
  console.log('End:', format(end, 'yyyy-MM-dd HH:mm:ss'))
  console.log('---')

  const matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`Found ${matches.length} basketball matches:`)

  matches.forEach((match) => {
    console.log(`- ${format(match.kickoffAt, 'yyyy-MM-dd HH:mm')} UTC: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.status})`)
  })

  // 데일리 리포트 확인
  console.log('\n--- Daily Reports ---')
  const reports = await prisma.dailyReport.findMany({
    where: {
      sportType: 'BASKETBALL',
    },
    orderBy: { date: 'desc' },
  })

  reports.forEach((report) => {
    console.log(`- ${format(report.date, 'yyyy-MM-dd')}: ${report.id}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
