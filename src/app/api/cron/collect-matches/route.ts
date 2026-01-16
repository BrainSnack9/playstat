import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { footballApi, LEAGUE_IDS, getCurrentFootballSeason } from '@/lib/api/sports-api'
import { format, addDays } from 'date-fns'
import slugify from 'slugify'

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/collect-matches
 * 크론: 오늘/내일 경기 일정 수집
 * 실행: 매일 06:00 KST
 */
export async function GET(request: Request) {
  // 인증 체크
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: { league: string; matchesAdded: number; errors: string[] }[] = []

  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const season = getCurrentFootballSeason()

    // 수집할 리그 목록
    const leaguesToCollect = [
      { id: LEAGUE_IDS.EPL, name: 'Premier League', slug: 'epl' },
      { id: LEAGUE_IDS.LALIGA, name: 'La Liga', slug: 'laliga' },
      { id: LEAGUE_IDS.SERIE_A, name: 'Serie A', slug: 'serie-a' },
      { id: LEAGUE_IDS.BUNDESLIGA, name: 'Bundesliga', slug: 'bundesliga' },
      { id: LEAGUE_IDS.UCL, name: 'Champions League', slug: 'ucl' },
      { id: LEAGUE_IDS.K_LEAGUE_1, name: 'K League 1', slug: 'k-league' },
    ]

    for (const league of leaguesToCollect) {
      const leagueResult = { league: league.name, matchesAdded: 0, errors: [] as string[] }

      try {
        // 리그가 DB에 있는지 확인, 없으면 생성
        let dbLeague = await prisma.league.findFirst({
          where: { externalId: String(league.id) },
        })

        if (!dbLeague) {
          dbLeague = await prisma.league.create({
            data: {
              name: league.name,
              country: 'Europe', // 기본값, 실제로는 API에서 가져옴
              sportType: 'FOOTBALL',
              externalId: String(league.id),
              season,
              isActive: true,
            },
          })
        }

        // 오늘/내일 경기 조회
        const fixtures = await footballApi.getFixturesByLeague(league.id, season, {
          from: today,
          to: tomorrow,
        })

        for (const fixture of fixtures) {
          try {
            // 이미 DB에 있는지 확인
            const existingMatch = await prisma.match.findFirst({
              where: { externalId: String(fixture.fixture.id) },
            })

            if (existingMatch) {
              // 이미 있으면 상태만 업데이트
              await prisma.match.update({
                where: { id: existingMatch.id },
                data: {
                  status: mapStatus(fixture.fixture.status.short),
                  homeScore: fixture.goals.home,
                  awayScore: fixture.goals.away,
                },
              })
              continue
            }

            // 홈팀/원정팀 확인 또는 생성
            const homeTeam = await findOrCreateTeam(
              fixture.teams.home,
              dbLeague.id
            )
            const awayTeam = await findOrCreateTeam(
              fixture.teams.away,
              dbLeague.id
            )

            // 경기 생성
            const matchSlug = createMatchSlug(
              league.slug,
              fixture.teams.home.name,
              fixture.teams.away.name,
              fixture.fixture.date
            )

            await prisma.match.create({
              data: {
                leagueId: dbLeague.id,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                sportType: 'FOOTBALL',
                kickoffAt: new Date(fixture.fixture.date),
                status: mapStatus(fixture.fixture.status.short),
                homeScore: fixture.goals.home,
                awayScore: fixture.goals.away,
                venue: fixture.fixture.venue?.name,
                round: fixture.league.round,
                slug: matchSlug,
                externalId: String(fixture.fixture.id),
              },
            })

            leagueResult.matchesAdded++
          } catch (error) {
            leagueResult.errors.push(`Fixture ${fixture.fixture.id}: ${String(error)}`)
          }
        }
      } catch (error) {
        leagueResult.errors.push(`League error: ${String(error)}`)
      }

      results.push(leagueResult)
    }

    // 스케줄러 로그 기록
    const duration = Date.now() - startTime
    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-matches',
        result: results.every((r) => r.errors.length === 0) ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: results.reduce((sum) => sum + 1, 0), // 리그당 1회
      },
    })

    return NextResponse.json({
      success: true,
      duration,
      results,
    })
  } catch (error) {
    console.error('Cron collect-matches error:', error)

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-matches',
        result: 'failed',
        details: { error: String(error) },
        duration: Date.now() - startTime,
      },
    })

    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// 팀 찾기 또는 생성
async function findOrCreateTeam(
  teamData: { id: number; name: string; logo: string },
  leagueId: string
) {
  let team = await prisma.team.findFirst({
    where: { externalId: String(teamData.id) },
  })

  if (!team) {
    team = await prisma.team.create({
      data: {
        leagueId,
        name: teamData.name,
        shortName: teamData.name.slice(0, 3).toUpperCase(),
        logoUrl: teamData.logo,
        externalId: String(teamData.id),
        sportType: 'FOOTBALL',
      },
    })
  }

  return team
}

// 경기 상태 매핑
function mapStatus(apiStatus: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' {
  const statusMap: Record<string, 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED'> = {
    TBD: 'SCHEDULED',
    NS: 'SCHEDULED',
    '1H': 'LIVE',
    HT: 'LIVE',
    '2H': 'LIVE',
    ET: 'LIVE',
    P: 'LIVE',
    FT: 'FINISHED',
    AET: 'FINISHED',
    PEN: 'FINISHED',
    PST: 'POSTPONED',
    CANC: 'CANCELLED',
    ABD: 'CANCELLED',
  }
  return statusMap[apiStatus] || 'SCHEDULED'
}

// 경기 slug 생성
function createMatchSlug(
  leagueSlug: string,
  homeTeam: string,
  awayTeam: string,
  date: string
): string {
  const dateStr = format(new Date(date), 'yyyyMMdd')
  const slug = slugify(
    `${leagueSlug}-${homeTeam}-vs-${awayTeam}-${dateStr}`,
    { lower: true, strict: true }
  )
  return slug
}
