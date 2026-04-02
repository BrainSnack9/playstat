import { NextResponse } from 'next/server'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_ROUNDUP_PROMPT, fillPrompt } from '@/lib/ai/prompts'
import { type PrismaClient, Prisma } from '@prisma/client'
import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET
const SYSTEM_AUTHOR_ID = 'system-auto-generator'

// 대상 리그 (유럽 5대 리그)
const ROUNDUP_LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1']

// 리그 코드 → 읽기 좋은 이름 매핑
const LEAGUE_NAMES: Record<string, string> = {
  PL: 'Premier League',
  PD: 'La Liga',
  SA: 'Serie A',
  BL1: 'Bundesliga',
  FL1: 'Ligue 1',
}

// 최소 완료 경기 수 (불완전한 라운드 방지)
const MIN_FINISHED_MATCHES = 6

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 슬러그 생성
 */
function generateSlug(leagueCode: string, matchday: number): string {
  const leagueName = LEAGUE_NAMES[leagueCode] || leagueCode
  const normalized = leagueName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
  const timestamp = Date.now().toString(36)
  return `${normalized}-matchday-${matchday}-roundup-${timestamp}`
}

/**
 * AI 응답 파싱
 */
function parseResponse(response: string) {
  try {
    let jsonStr = response.trim()
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    }
    const parsed = JSON.parse(jsonStr)
    return {
      title: parsed.title || '',
      excerpt: parsed.excerpt || '',
      content: parsed.content || '',
      metaTitle: parsed.metaTitle || parsed.title || '',
      metaDescription: parsed.metaDescription || parsed.excerpt || '',
    }
  } catch {
    return null
  }
}

/**
 * GET /api/cron/generate-blog-roundup
 * 크론: 주간 리그 라운드업 자동 생성 (DRAFT)
 * 쿼리 파라미터: ?league=PL (특정 리그만 실행)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 })
  }

  const prisma = await getPrisma()
  const startTime = Date.now()
  const results: { league: string; matchday?: number; slug?: string; success: boolean; error?: string }[] = []

  // 특정 리그만 실행하는 옵션
  const url = new URL(request.url)
  const leagueParam = url.searchParams.get('league')
  const targetLeagues = leagueParam ? [leagueParam.toUpperCase()] : ROUNDUP_LEAGUES

  try {
    for (const leagueCode of targetLeagues) {
      try {
        // 1. 리그 정보 조회
        const league = await prisma.league.findFirst({
          where: {
            code: leagueCode,
            sportType: 'FOOTBALL',
          },
        })

        if (!league) {
          results.push({ league: leagueCode, success: false, error: 'League not found' })
          continue
        }

        // 2. 최근 완료된 matchday 판별
        // 가장 최근 FINISHED 경기의 matchday를 찾음
        const latestFinished = await prisma.match.findFirst({
          where: {
            leagueId: league.id,
            status: 'FINISHED',
            matchday: { not: null },
          },
          orderBy: { matchday: 'desc' },
          select: { matchday: true },
        })

        if (!latestFinished?.matchday) {
          results.push({ league: leagueCode, success: false, error: 'No finished matchday found' })
          continue
        }

        const matchday = latestFinished.matchday

        // 3. 중복 확인 (같은 리그+matchday로 이미 생성된 글 있는지)
        const existingPost = await prisma.blogPost.findFirst({
          where: {
            category: 'ROUNDUP',
            slug: {
              contains: `${(LEAGUE_NAMES[leagueCode] || leagueCode).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}-matchday-${matchday}`,
            },
          },
        })

        if (existingPost) {
          results.push({ league: leagueCode, matchday, success: true, error: 'Already exists' })
          continue
        }

        // 4. 해당 matchday의 FINISHED 경기 조회
        const matches = await prisma.match.findMany({
          where: {
            leagueId: league.id,
            matchday,
            status: 'FINISHED',
          },
          include: {
            homeTeam: { include: { seasonStats: true } },
            awayTeam: { include: { seasonStats: true } },
          },
          orderBy: { kickoffAt: 'asc' },
        })

        if (matches.length < MIN_FINISHED_MATCHES) {
          results.push({
            league: leagueCode,
            matchday,
            success: false,
            error: `Only ${matches.length} finished matches (need ${MIN_FINISHED_MATCHES}+)`,
          })
          continue
        }

        // 5. 현재 순위표 조회 (상위 10팀 + 강등권 5팀)
        const allStandings = await prisma.teamSeasonStats.findMany({
          where: {
            team: { leagueId: league.id },
            rank: { not: null },
          },
          include: { team: true },
          orderBy: { rank: 'asc' },
        })

        const standingsTop10 = allStandings.slice(0, 10).map((s) => ({
          rank: s.rank,
          team: s.team.name,
          points: s.points || 0,
          wins: s.wins,
          draws: s.draws || 0,
          losses: s.losses,
          goal_difference: s.goalDifference || 0,
          form: s.form || '',
        }))

        const relegationZone = allStandings.slice(-5).map((s) => ({
          rank: s.rank,
          team: s.team.name,
          points: s.points || 0,
          form: s.form || '',
        }))

        // 6. 라운드업 데이터 조립
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchResults = (matches as any[]).map((m) => ({
          home_team: m.homeTeam?.name || '',
          away_team: m.awayTeam?.name || '',
          home_score: m.homeScore ?? 0,
          away_score: m.awayScore ?? 0,
          home_rank: m.homeTeam?.seasonStats?.rank || null,
          away_rank: m.awayTeam?.seasonStats?.rank || null,
        }))

        const roundupData = {
          league: {
            name: league.name,
            code: leagueCode,
            matchday,
            season: league.season || new Date().getFullYear(),
          },
          matches: matchResults,
          standings_top10: standingsTop10,
          relegation_zone: relegationZone,
        }

        // 7. AI 호출
        const prompt = fillPrompt(BLOG_ROUNDUP_PROMPT, {
          roundupData: JSON.stringify(roundupData, null, 2),
        })

        const completion = await openai.chat.completions.create({
          model: AI_MODELS.ANALYSIS,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 5000,
          temperature: 0.85,
        })

        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) {
          results.push({ league: leagueCode, matchday, success: false, error: 'Empty AI response' })
          continue
        }

        // 8. 응답 파싱 → BlogPost 생성
        const blogContent = parseResponse(aiResponse)
        if (!blogContent) {
          results.push({ league: leagueCode, matchday, success: false, error: 'Failed to parse response' })
          continue
        }

        const slug = generateSlug(leagueCode, matchday)

        await prisma.blogPost.create({
          data: {
            slug,
            category: 'ROUNDUP',
            sportType: 'FOOTBALL',
            authorId: SYSTEM_AUTHOR_ID,
            status: 'DRAFT',
            translations: {
              ko: {
                title: blogContent.title,
                excerpt: blogContent.excerpt,
                content: blogContent.content,
                metaTitle: blogContent.metaTitle,
                metaDescription: blogContent.metaDescription,
              },
            } as Prisma.InputJsonValue,
            viewCount: 0,
          },
        })

        revalidateTag('blog')
        results.push({ league: leagueCode, matchday, slug, success: true })
      } catch (error) {
        console.error(`Error generating roundup for ${leagueCode}:`, error)
        results.push({
          league: leagueCode,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const duration = Date.now() - startTime
    const successCount = results.filter((r) => r.success && !r.error?.includes('Already')).length

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount} league roundups`,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('Blog roundup generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
