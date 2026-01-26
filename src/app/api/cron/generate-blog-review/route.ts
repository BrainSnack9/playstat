import { NextResponse } from 'next/server'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_REVIEW_PROMPT, fillPrompt } from '@/lib/ai/prompts'
import { subHours } from 'date-fns'
import { type PrismaClient, Prisma } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import { ensureBlogPostTranslations } from '@/lib/ai/translate'

const CRON_SECRET = process.env.CRON_SECRET
const SYSTEM_AUTHOR_ID = 'system-auto-generator'

// 리뷰 대상 리그 (유럽 5대 리그)
const REVIEW_LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1']

// 리뷰 대상 기준: 양 팀 중 하나라도 상위권
const TOP_RANK_THRESHOLD = 10

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 리뷰 대상 경기 여부 판별
 */
function isReviewWorthy(
  homeRank: number | null | undefined,
  awayRank: number | null | undefined,
  leagueCode: string | null | undefined
): boolean {
  if (!leagueCode || !REVIEW_LEAGUES.includes(leagueCode)) {
    return false
  }
  // 한 팀이라도 상위권이면 리뷰 대상
  if (homeRank && homeRank <= TOP_RANK_THRESHOLD) return true
  if (awayRank && awayRank <= TOP_RANK_THRESHOLD) return true
  return false
}

/**
 * 슬러그 생성
 */
function generateSlug(homeTeam: string, awayTeam: string, leagueName: string): string {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').replace(/\s+/g, '-').substring(0, 30)
  const home = normalize(homeTeam)
  const away = normalize(awayTeam)
  const league = normalize(leagueName)
  const timestamp = Date.now().toString(36)
  return `${home}-vs-${away}-${league}-review-${timestamp}`
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
 * GET /api/cron/generate-blog-review
 * 크론: 최근 종료된 경기에 대한 리뷰 자동 생성 (DRAFT)
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
    const hours6Ago = subHours(now, 6)

    // 최근 6시간 내 종료된 경기 조회
    const finishedMatches = await prisma.match.findMany({
      where: {
        sportType: 'FOOTBALL',
        status: 'FINISHED',
        kickoffAt: {
          gte: hours6Ago,
          lte: now,
        },
        league: {
          code: { in: REVIEW_LEAGUES },
        },
      },
      include: {
        league: true,
        homeTeam: { include: { seasonStats: true } },
        awayTeam: { include: { seasonStats: true } },
      },
      take: 5,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const match of finishedMatches as any[]) {
      try {
        const homeStats = match.homeTeam?.seasonStats
        const awayStats = match.awayTeam?.seasonStats
        const homeRank = homeStats?.rank
        const awayRank = awayStats?.rank

        if (!isReviewWorthy(homeRank, awayRank, match.league?.code)) {
          continue
        }

        const homeTeamName = match.homeTeam?.name || ''
        const awayTeamName = match.awayTeam?.name || ''
        const leagueName = match.league?.name || ''

        // 이미 리뷰가 있는지 확인
        const existingPost = await prisma.blogPost.findFirst({
          where: {
            category: 'REVIEW',
            slug: {
              contains: `${homeTeamName.toLowerCase().replace(/\s+/g, '-')}-vs-${awayTeamName.toLowerCase().replace(/\s+/g, '-')}`.substring(0, 40),
            },
            createdAt: { gte: hours6Ago },
          },
        })

        if (existingPost) {
          results.push({ matchId: match.id, success: true, error: 'Already exists' })
          continue
        }

        // 경기 결과 데이터 구성
        const matchData = {
          match: {
            league: leagueName,
            home_team: homeTeamName,
            away_team: awayTeamName,
            home_score: match.homeScore ?? 0,
            away_score: match.awayScore ?? 0,
            kickoff_at: match.kickoffAt?.toISOString() || '',
          },
          home: {
            rank: homeRank,
            season: {
              wins: homeStats?.wins || 0,
              draws: homeStats?.draws || 0,
              losses: homeStats?.losses || 0,
              points: homeStats?.points || 0,
            },
          },
          away: {
            rank: awayRank,
            season: {
              wins: awayStats?.wins || 0,
              draws: awayStats?.draws || 0,
              losses: awayStats?.losses || 0,
              points: awayStats?.points || 0,
            },
          },
        }

        // AI 호출
        const prompt = fillPrompt(BLOG_REVIEW_PROMPT, {
          matchData: JSON.stringify(matchData, null, 2),
        })

        const completion = await openai.chat.completions.create({
          model: AI_MODELS.ANALYSIS,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
          temperature: 0.8,
        })

        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) {
          results.push({ matchId: match.id, success: false, error: 'Empty AI response' })
          continue
        }

        const blogContent = parseResponse(aiResponse)
        if (!blogContent) {
          results.push({ matchId: match.id, success: false, error: 'Failed to parse response' })
          continue
        }

        const slug = generateSlug(homeTeamName, awayTeamName, leagueName)

        const newPost = await prisma.blogPost.create({
          data: {
            slug,
            category: 'REVIEW',
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

        ensureBlogPostTranslations(newPost).catch((err) => {
          console.error(`Failed to translate blog review ${slug}:`, err)
        })

        revalidateTag('blog')
        results.push({ matchId: match.id, slug, success: true })
      } catch (error) {
        console.error(`Error generating review for match ${match.id}:`, error)
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
      message: `Generated ${successCount} blog reviews`,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('Blog review generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
