import { NextResponse } from 'next/server'
import {
  footballDataApi,
  FREE_COMPETITIONS,
  type Match as FDMatch,
} from '@/lib/api/football-data'
import { format, addDays } from 'date-fns'
import slugify from 'slugify'
import type { PrismaClient, MatchStatus } from '@prisma/client'

import { revalidateTag } from 'next/cache'
import { isValidSportId, type SportId } from '@/lib/sport'

// Vercel Function 설정 - App Router
export const maxDuration = 300 // 5분
export const dynamic = 'force-dynamic'

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET

// 동적 prisma 가져오기
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// 수집할 무료 리그 목록
const LEAGUES_TO_COLLECT = [
  { code: FREE_COMPETITIONS.PREMIER_LEAGUE, name: 'Premier League', country: 'England', slug: 'epl' },
  { code: FREE_COMPETITIONS.LA_LIGA, name: 'La Liga', country: 'Spain', slug: 'laliga' },
  { code: FREE_COMPETITIONS.SERIE_A, name: 'Serie A', country: 'Italy', slug: 'serie-a' },
  { code: FREE_COMPETITIONS.BUNDESLIGA, name: 'Bundesliga', country: 'Germany', slug: 'bundesliga' },
  { code: FREE_COMPETITIONS.LIGUE_1, name: 'Ligue 1', country: 'France', slug: 'ligue1' },
  { code: FREE_COMPETITIONS.CHAMPIONS_LEAGUE, name: 'Champions League', country: 'Europe', slug: 'ucl' },
  { code: FREE_COMPETITIONS.EREDIVISIE, name: 'Eredivisie', country: 'Netherlands', slug: 'eredivisie' },
  { code: FREE_COMPETITIONS.PRIMEIRA_LIGA, name: 'Primeira Liga', country: 'Portugal', slug: 'primeira-liga' },
]

/**
 * GET /api/cron/collect-matches
 * 크론: 오늘~7일 후 경기 일정 수집
 *
 * Query params:
 * - sport: 'football' | 'basketball' | 'baseball' (기본: 'football')
 * - chain: 'true'면 후속 작업들 순차 호출
 *
 * 현재 지원: football (Football-Data.org API)
 * 추후 지원 예정: basketball, baseball (API-Sports 등 별도 통합 필요)
 */
export async function GET(request: Request) {
  // 인증 체크
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const sportParam = url.searchParams.get('sport') || 'football'
  const sport: SportId = isValidSportId(sportParam) ? sportParam : 'football'

  // 현재는 football만 지원
  if (sport !== 'football') {
    return NextResponse.json({
      success: false,
      error: `Sport '${sport}' is not yet supported. Only 'football' is currently available.`,
      message: 'Basketball and baseball data collection requires additional API integration.',
    }, { status: 501 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results: { sport: SportId; matchesAdded: number; matchesUpdated: number; errors: string[] } = { sport, matchesAdded: 0, matchesUpdated: 0, errors: [] }
  let totalApiCalls = 0

  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')

    // 모든 리그 정보를 먼저 가져오거나 확인
    const dbLeagues = await prisma.league.findMany({
      where: { code: { in: LEAGUES_TO_COLLECT.map(l => l.code) } }
    })
    
    const leagueMap = new Map(dbLeagues.map(l => [l.code, l]))

    // 모든 지원 리그의 경기를 한 번에 조회 (API 호출 1회)
    const matchesResponse = await footballDataApi.getMatchesByDateRange(today, nextWeek)
    totalApiCalls++

    for (const match of matchesResponse.matches) {
      try {
        const competitionCode = match.competition.code
        const leagueInfo = LEAGUES_TO_COLLECT.find(l => l.code === competitionCode)
        
        // 우리가 지원하는 리그가 아니면 스킵
        if (!leagueInfo) continue

        let dbLeague = leagueMap.get(competitionCode)
        if (!dbLeague) {
          // 리그가 없으면 새로 생성
          dbLeague = await prisma.league.create({
            data: {
              name: match.competition.name,
              country: leagueInfo.country,
              sportType: 'FOOTBALL',
              externalId: String(match.competition.id),
              code: competitionCode,
              logoUrl: match.competition.emblem,
              isActive: true,
            }
          })
          leagueMap.set(competitionCode, dbLeague)
        }

        // 이미 DB에 있는지 확인
        const existingMatch = await prisma.match.findFirst({
          where: { externalId: String(match.id) },
        })

        if (existingMatch) {
          await prisma.match.update({
            where: { id: existingMatch.id },
            data: {
              status: mapStatus(match.status),
              homeScore: match.score.fullTime.home,
              awayScore: match.score.fullTime.away,
              halfTimeHome: match.score.halfTime.home,
              halfTimeAway: match.score.halfTime.away,
            },
          })
          results.matchesUpdated++
          continue
        }

        // 홈팀/원정팀 확인 또는 생성
        const homeTeam = await findOrCreateTeam(prisma, match.homeTeam, dbLeague.id)
        const awayTeam = await findOrCreateTeam(prisma, match.awayTeam, dbLeague.id)

        // 경기 생성
        const matchSlug = createMatchSlug(
          leagueInfo.slug,
          match.homeTeam.shortName || match.homeTeam.name,
          match.awayTeam.shortName || match.awayTeam.name,
          match.utcDate
        )

        await prisma.match.create({
          data: {
            leagueId: dbLeague.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            sportType: 'FOOTBALL',
            kickoffAt: new Date(match.utcDate),
            status: mapStatus(match.status),
            homeScore: match.score.fullTime.home,
            awayScore: match.score.fullTime.away,
            halfTimeHome: match.score.halfTime.home,
            halfTimeAway: match.score.halfTime.away,
            matchday: match.matchday,
            stage: match.stage,
            venue: match.venue,
            slug: matchSlug,
            externalId: String(match.id),
          },
        })

        results.matchesAdded++
      } catch (error) {
        results.errors.push(`Match ${match.id}: ${String(error)}`)
      }
    }

    // 스케줄러 로그 기록
    const duration = Date.now() - startTime
    
    // 캐시 무효화: 새로운 경기 데이터가 추가되거나 업데이트되었을 때
    if (results.matchesAdded > 0 || results.matchesUpdated > 0) {
      console.log('[Cron] Revalidating match tags after collection...')
      revalidateTag('matches')
      revalidateTag('match-detail')
      revalidateTag('daily-report')
    }

    await prisma.schedulerLog.create({
      data: {
        jobName: 'collect-matches',
        result: results.errors.length === 0 ? 'success' : 'partial',
        details: results,
        duration,
        apiCalls: totalApiCalls,
      },
    })

    // chain=true면 후속 작업들 순차 호출
    const shouldChain = url.searchParams.get('chain') === 'true'
    const chainResults: { job: string; success: boolean; error?: string }[] = []

    if (shouldChain && CRON_SECRET) {
      const baseUrl = url.origin
      const cronJobs = [
        '/api/cron/collect-team-data',
        '/api/cron/generate-analysis',
        '/api/cron/generate-daily-report',
      ]

      for (const job of cronJobs) {
        try {
          const response = await fetch(`${baseUrl}${job}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${CRON_SECRET}`,
            },
          })
          const data = await response.json()
          chainResults.push({ job, success: data.success !== false })
        } catch (error) {
          chainResults.push({ job, success: false, error: String(error) })
        }
      }
    }

    return NextResponse.json({
      success: true,
      duration,
      apiCalls: totalApiCalls,
      results,
      chainResults: shouldChain ? chainResults : undefined,
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
  prisma: PrismaClient,
  teamData: FDMatch['homeTeam'],
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
        shortName: teamData.shortName,
        tla: teamData.tla,
        logoUrl: teamData.crest,
        externalId: String(teamData.id),
        sportType: 'FOOTBALL',
      },
    })
  }

  return team
}

// 경기 상태 매핑 (Football-Data.org -> Prisma enum)
function mapStatus(apiStatus: FDMatch['status']): MatchStatus {
  const statusMap: Record<FDMatch['status'], MatchStatus> = {
    SCHEDULED: 'SCHEDULED',
    TIMED: 'TIMED',
    IN_PLAY: 'LIVE',
    PAUSED: 'LIVE',
    FINISHED: 'FINISHED',
    SUSPENDED: 'SUSPENDED',
    POSTPONED: 'POSTPONED',
    CANCELLED: 'CANCELLED',
    AWARDED: 'FINISHED',
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
