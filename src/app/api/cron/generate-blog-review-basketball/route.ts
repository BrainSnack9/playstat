import { NextResponse } from 'next/server'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_REVIEW_PROMPT_BASKETBALL, fillPrompt } from '@/lib/ai/prompts'
import { subHours } from 'date-fns'
import { type PrismaClient, Prisma } from '@prisma/client'
import { revalidateTag } from 'next/cache'

const CRON_SECRET = process.env.CRON_SECRET
const SYSTEM_AUTHOR_ID = 'system-auto-generator'

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 슬러그 생성 (ASCII만 허용)
 */
function generateSlug(homeTeam: string, awayTeam: string): string {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 30)
  const home = normalize(homeTeam)
  const away = normalize(awayTeam)
  const timestamp = Date.now().toString(36)
  return `nba-${home}-vs-${away}-review-${timestamp}`
}

/**
 * AI 응답 파싱
 */
function parseResponse(response: string) {
  try {
    let jsonStr = response.trim()
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/^[\s\S]*?```json\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim()
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/^[\s\S]*?```\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim()
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
 * GET /api/cron/generate-blog-review-basketball
 * 크론: 최근 종료된 NBA 경기 리뷰 자동 생성 (DRAFT)
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

    // 최근 6시간 내 종료된 NBA 경기 조회
    const finishedMatches = await prisma.match.findMany({
      where: {
        sportType: 'BASKETBALL',
        status: 'FINISHED',
        kickoffAt: {
          gte: hours6Ago,
          lte: now,
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

        // 한 팀이라도 상위권(10위 이내)이면 리뷰 대상
        const isReviewWorthy =
          (homeRank && homeRank <= 10) || (awayRank && awayRank <= 10)

        if (!isReviewWorthy) {
          continue
        }

        const homeTeamName = match.homeTeam?.name || ''
        const awayTeamName = match.awayTeam?.name || ''

        // 이미 리뷰가 있는지 확인
        const existingPost = await prisma.blogPost.findFirst({
          where: {
            sportType: 'BASKETBALL',
            category: 'REVIEW',
            slug: {
              contains: `${homeTeamName.toLowerCase().replace(/\s+/g, '-')}-vs-${awayTeamName.toLowerCase().replace(/\s+/g, '-')}`.substring(0, 30),
            },
            createdAt: { gte: hours6Ago },
          },
        })

        if (existingPost) {
          results.push({ matchId: match.id, success: true, error: 'Already exists' })
          continue
        }

        // 경기 데이터 구성
        const matchData = {
          match: {
            league: match.league?.name || 'NBA',
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
              losses: homeStats?.losses || 0,
            },
          },
          away: {
            rank: awayRank,
            season: {
              wins: awayStats?.wins || 0,
              losses: awayStats?.losses || 0,
            },
          },
        }

        // AI 호출
        const prompt = fillPrompt(BLOG_REVIEW_PROMPT_BASKETBALL, {
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

        const slug = generateSlug(homeTeamName, awayTeamName)

        await prisma.blogPost.create({
          data: {
            slug,
            category: 'REVIEW',
            sportType: 'BASKETBALL',
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
      message: `Generated ${successCount} NBA blog reviews`,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('NBA blog review generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
