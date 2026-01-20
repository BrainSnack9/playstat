import { PrismaClient } from '@prisma/client'
import { getDayRangeInTimezone } from '../src/lib/timezone'
import { format } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  const timezone = 'Asia/Seoul'

  console.log('=== Checking reports for timezone:', timezone, '===\n')

  // 19일 한국 시간
  const { start: jan19Start, end: jan19End } = getDayRangeInTimezone('2026-01-19', timezone)
  console.log('Jan 19 KST Range:')
  console.log('  Start (UTC):', format(jan19Start, 'yyyy-MM-dd HH:mm:ss'))
  console.log('  End (UTC):  ', format(jan19End, 'yyyy-MM-dd HH:mm:ss'))

  const jan19Matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: { gte: jan19Start, lte: jan19End },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`  Found ${jan19Matches.length} matches:`)
  jan19Matches.forEach((m) => {
    console.log(`    - ${format(m.kickoffAt, 'yyyy-MM-dd HH:mm')} UTC: ${m.homeTeam.name} vs ${m.awayTeam.name}`)
  })

  // 20일 한국 시간
  console.log('\nJan 20 KST Range:')
  const { start: jan20Start, end: jan20End } = getDayRangeInTimezone('2026-01-20', timezone)
  console.log('  Start (UTC):', format(jan20Start, 'yyyy-MM-dd HH:mm:ss'))
  console.log('  End (UTC):  ', format(jan20End, 'yyyy-MM-dd HH:mm:ss'))

  const jan20Matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: { gte: jan20Start, lte: jan20End },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`  Found ${jan20Matches.length} matches:`)
  jan20Matches.forEach((m) => {
    console.log(`    - ${format(m.kickoffAt, 'yyyy-MM-dd HH:mm')} UTC: ${m.homeTeam.name} vs ${m.awayTeam.name}`)
  })

  // 데일리 리포트 확인
  console.log('\n=== Daily Reports ===')
  const reports = await prisma.dailyReport.findMany({
    where: { sportType: 'BASKETBALL' },
    orderBy: { date: 'desc' },
    take: 5,
  })

  reports.forEach((r) => {
    console.log(`- ${format(r.date, 'yyyy-MM-dd HH:mm:ss')} UTC → ${r.id}`)
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
