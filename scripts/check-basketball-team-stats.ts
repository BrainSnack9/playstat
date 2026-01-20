import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking Basketball Team Data ===\n')

  // Check team season stats
  const seasonStats = await prisma.teamSeasonStats.findMany({
    where: { sportType: 'BASKETBALL' },
    include: { team: true },
  })

  console.log(`📊 Team Season Stats: ${seasonStats.length} teams`)
  if (seasonStats.length > 0) {
    console.log('Sample:', seasonStats[0].team.name, {
      gamesPlayed: seasonStats[0].gamesPlayed,
      wins: seasonStats[0].wins,
      losses: seasonStats[0].losses,
    })
  }

  // Check team recent matches
  const recentMatches = await prisma.teamRecentMatches.findMany({
    where: { sportType: 'BASKETBALL' },
    include: { team: true },
  })

  console.log(`\n🔥 Team Recent Matches: ${recentMatches.length} teams`)
  if (recentMatches.length > 0) {
    console.log('Sample:', recentMatches[0].team.name, {
      recentForm: recentMatches[0].recentForm,
      matches: Array.isArray(recentMatches[0].matchesJson)
        ? recentMatches[0].matchesJson.length
        : 0,
    })
  }

  // Check basketball matches
  const matches = await prisma.match.findMany({
    where: {
      sportType: 'BASKETBALL',
      kickoffAt: { gte: new Date() },
    },
    include: {
      homeTeam: { include: { seasonStats: true, recentMatches: true } },
      awayTeam: { include: { seasonStats: true, recentMatches: true } },
    },
    orderBy: { kickoffAt: 'asc' },
    take: 5,
  })

  console.log(`\n⚽ Upcoming Matches: ${matches.length}`)
  for (const match of matches) {
    const homeHasStats = !!match.homeTeam.seasonStats
    const awayHasStats = !!match.awayTeam.seasonStats
    const homeHasRecent = !!match.homeTeam.recentMatches
    const awayHasRecent = !!match.awayTeam.recentMatches

    console.log(
      `  ${match.homeTeam.name} vs ${match.awayTeam.name} - ` +
        `Stats: ${homeHasStats ? '✅' : '❌'}/${awayHasStats ? '✅' : '❌'} | ` +
        `Recent: ${homeHasRecent ? '✅' : '❌'}/${awayHasRecent ? '✅' : '❌'}`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
