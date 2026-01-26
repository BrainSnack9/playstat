import { NextResponse } from 'next/server'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_PREVIEW_PROMPT, fillPrompt, formatMatchDataForAI, type MatchAnalysisInputData } from '@/lib/ai/prompts'
import { addHours } from 'date-fns'
import { type PrismaClient, Prisma } from '@prisma/client'
import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET

// 시스템 작성자 ID (자동 생성용)
const SYSTEM_AUTHOR_ID = 'system-auto-generator'

// 빅매치 대상 리그 (유럽 5대 리그)
const BIG_MATCH_LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1']

// 빅매치 판별 기준: 양 팀 모두 상위권 (N위 이내)
const TOP_RANK_THRESHOLD = 15

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 빅매치 여부 판별
 */
function isBigMatch(
  homeRank: number | null | undefined,
  awayRank: number | null | undefined,
  leagueCode: string | null | undefined
): boolean {
  // 5대 리그가 아니면 빅매치 아님
  if (!leagueCode || !BIG_MATCH_LEAGUES.includes(leagueCode)) {
    return false
  }

  // 양 팀 순위 정보가 있고, 둘 다 상위권이면 빅매치
  if (homeRank && awayRank) {
    return homeRank <= TOP_RANK_THRESHOLD && awayRank <= TOP_RANK_THRESHOLD
  }

  return false
}

/**
 * 슬러그 생성 (ASCII만 허용)
 */
function generateSlug(homeTeam: string, awayTeam: string, leagueName: string): string {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30)

  const home = normalize(homeTeam)
  const away = normalize(awayTeam)
  const league = normalize(leagueName)
  const timestamp = Date.now().toString(36)

  return `${home}-vs-${away}-${league}-preview-${timestamp}`
}

/**
 * AI 응답에서 블로그 콘텐츠 파싱
 */
function parseBlogResponse(response: string): {
  title: string
  excerpt: string
  content: string
  metaTitle: string
  metaDescription: string
} | null {
  try {
    const trimmed = response.trim()
    let jsonStr = trimmed

    // ```json ... ``` 코드블록 제거
    if (trimmed.includes('```json')) {
      jsonStr = trimmed
        .replace(/^```json\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim()
    } else if (trimmed.startsWith('```')) {
      jsonStr = trimmed.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    }

    const parsed = JSON.parse(jsonStr)

    return {
      title: parsed.title || '',
      excerpt: parsed.excerpt || '',
      content: parsed.content || '',
      metaTitle: parsed.metaTitle || parsed.title || '',
      metaDescription: parsed.metaDescription || parsed.excerpt || '',
    }
  } catch (error) {
    console.error('Failed to parse blog response:', error)
    return null
  }
}

/**
 * GET /api/cron/generate-blog-preview
 * 크론: 빅매치 48시간 전 블로그 프리뷰 자동 생성 (DRAFT 상태)
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
  const results: { matchId: string; slug?: string; success: boolean; error?: string }[] = []

  try {
    const now = new Date()
    const in48Hours = addHours(now, 48)

    // 48시간 이내 축구 경기 중 빅매치 후보 조회
    const upcomingMatches = await prisma.match.findMany({
      where: {
        sportType: 'FOOTBALL',
        kickoffAt: {
          gte: now,
          lte: in48Hours,
        },
        status: { in: ['SCHEDULED', 'TIMED'] },
        league: {
          code: { in: BIG_MATCH_LEAGUES },
        },
      },
      include: {
        league: true,
        homeTeam: {
          include: {
            seasonStats: true,
          },
        },
        awayTeam: {
          include: {
            seasonStats: true,
          },
        },
      },
      take: 10,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const match of upcomingMatches as any[]) {
      try {
        // 빅매치 판별
        const homeStats = match.homeTeam?.seasonStats
        const awayStats = match.awayTeam?.seasonStats
        const homeRank = homeStats?.rank
        const awayRank = awayStats?.rank

        if (!isBigMatch(homeRank, awayRank, match.league?.code)) {
          continue
        }

        // 이미 이 경기에 대한 포스트가 있는지 확인
        const homeTeamName = match.homeTeam?.name || ''
        const awayTeamName = match.awayTeam?.name || ''
        const leagueName = match.league?.name || ''

        const existingPost = await prisma.blogPost.findFirst({
          where: {
            slug: {
              contains: `${homeTeamName.toLowerCase().replace(/\s+/g, '-')}-vs-${awayTeamName.toLowerCase().replace(/\s+/g, '-')}`.substring(0, 40),
            },
          },
        })

        if (existingPost) {
          results.push({ matchId: match.id, success: true, error: 'Already exists' })
          continue
        }

        // H2H 데이터 조회
        const h2hRecord = await prisma.headToHead.findFirst({
          where: {
            OR: [
              { teamAId: match.homeTeamId, teamBId: match.awayTeamId },
              { teamAId: match.awayTeamId, teamBId: match.homeTeamId },
            ],
          },
        })

        // H2H JSON 파싱
        interface H2HMatch {
          date: string
          homeTeam: string
          awayTeam: string
          homeScore: number
          awayScore: number
          winner: string
        }
        const h2hMatches: H2HMatch[] = h2hRecord?.matchesJson
          ? (h2hRecord.matchesJson as unknown as H2HMatch[]).slice(0, 5)
          : []

        // AI 입력 데이터 구성
        const inputData: MatchAnalysisInputData = {
          match: {
            sport_type: 'football',
            league: leagueName,
            kickoff_at: match.kickoffAt?.toISOString() || '',
            home_team: homeTeamName,
            away_team: awayTeamName,
          },
          home: {
            recent_5: [], // 최근 경기 데이터는 별도 조회 필요
            season: {
              rank: homeStats?.rank || undefined,
              points: homeStats?.points || undefined,
              games_played: homeStats?.gamesPlayed || 0,
              wins: homeStats?.wins || 0,
              draws: homeStats?.draws || 0,
              losses: homeStats?.losses || 0,
              avg_scored: homeStats?.avgScored || 0,
              avg_allowed: homeStats?.avgAllowed || 0,
              home_avg_scored: homeStats?.homeAvgScored || undefined,
              home_avg_allowed: homeStats?.homeAvgAllowed || undefined,
            },
          },
          away: {
            recent_5: [],
            season: {
              rank: awayStats?.rank || undefined,
              points: awayStats?.points || undefined,
              games_played: awayStats?.gamesPlayed || 0,
              wins: awayStats?.wins || 0,
              draws: awayStats?.draws || 0,
              losses: awayStats?.losses || 0,
              avg_scored: awayStats?.avgScored || 0,
              avg_allowed: awayStats?.avgAllowed || 0,
              away_avg_scored: awayStats?.awayAvgScored || undefined,
              away_avg_allowed: awayStats?.awayAvgAllowed || undefined,
            },
          },
          h2h: h2hMatches.map((h) => ({
            date: h.date || '',
            result: `${h.homeScore}-${h.awayScore}`,
            winner: h.winner || 'draw',
          })),
        }

        // AI 호출
        const prompt = fillPrompt(BLOG_PREVIEW_PROMPT, {
          matchData: formatMatchDataForAI(inputData),
        })

        const completion = await openai.chat.completions.create({
          model: AI_MODELS.ANALYSIS,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
          temperature: 0.8, // 더 창의적인 글을 위해 온도 높임
        })

        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) {
          results.push({ matchId: match.id, success: false, error: 'Empty AI response' })
          continue
        }

        const blogContent = parseBlogResponse(aiResponse)
        if (!blogContent) {
          results.push({ matchId: match.id, success: false, error: 'Failed to parse response' })
          continue
        }

        // 블로그 포스트 생성 (DRAFT 상태)
        const slug = generateSlug(homeTeamName, awayTeamName, leagueName)

        await prisma.blogPost.create({
          data: {
            slug,
            category: 'PREVIEW',
            sportType: 'FOOTBALL',
            authorId: SYSTEM_AUTHOR_ID,
            status: 'DRAFT', // 임시저장 상태
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

        // 캐시 무효화
        revalidateTag('blog')

        results.push({ matchId: match.id, slug, success: true })
      } catch (error) {
        console.error(`Error generating blog for match ${match.id}:`, error)
        results.push({
          matchId: match.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const duration = Date.now() - startTime
    const successCount = results.filter((r) => r.success && !r.error?.includes('Already')).length

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount} blog previews`,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('Blog preview generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
