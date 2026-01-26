import { NextResponse } from 'next/server'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_ANALYSIS_PROMPT, fillPrompt } from '@/lib/ai/prompts'
import { type PrismaClient, Prisma } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import { ensureBlogPostTranslations } from '@/lib/ai/translate'

const CRON_SECRET = process.env.CRON_SECRET
const SYSTEM_AUTHOR_ID = 'system-auto-generator'

// 분석 대상 리그
const ANALYSIS_LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1']

async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/**
 * 슬러그 생성
 */
function generateSlug(topic: string): string {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').replace(/\s+/g, '-').substring(0, 50)
  const timestamp = Date.now().toString(36)
  return `${normalize(topic)}-analysis-${timestamp}`
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
 * 분석 주제 생성 (주간 자동 생성용)
 */
async function generateWeeklyTopics(prisma: PrismaClient): Promise<{ topic: string; data: object }[]> {
  const topics: { topic: string; data: object }[] = []

  // 1. 리그별 상위권 팀 분석
  const topTeams = await prisma.team.findMany({
    where: {
      sportType: 'FOOTBALL',
      league: { code: { in: ANALYSIS_LEAGUES } },
      seasonStats: { rank: { lte: 5 } },
    },
    include: {
      league: true,
      seasonStats: true,
    },
    take: 10,
  })

  // 랜덤으로 2팀 비교 분석 주제 생성
  if (topTeams.length >= 2) {
    const shuffled = topTeams.sort(() => Math.random() - 0.5)
    const team1 = shuffled[0]
    const team2 = shuffled[1]

    topics.push({
      topic: `${team1.name} vs ${team2.name} 시즌 성적 비교`,
      data: {
        type: 'team_comparison',
        team1: {
          name: team1.name,
          league: team1.league?.name,
          rank: team1.seasonStats?.rank,
          points: team1.seasonStats?.points,
          wins: team1.seasonStats?.wins,
          draws: team1.seasonStats?.draws,
          losses: team1.seasonStats?.losses,
          goalsFor: team1.seasonStats?.goalsFor,
          goalsAgainst: team1.seasonStats?.goalsAgainst,
        },
        team2: {
          name: team2.name,
          league: team2.league?.name,
          rank: team2.seasonStats?.rank,
          points: team2.seasonStats?.points,
          wins: team2.seasonStats?.wins,
          draws: team2.seasonStats?.draws,
          losses: team2.seasonStats?.losses,
          goalsFor: team2.seasonStats?.goalsFor,
          goalsAgainst: team2.seasonStats?.goalsAgainst,
        },
      },
    })
  }

  // 2. 리그 시즌 중간 점검
  const leagues = await prisma.league.findMany({
    where: { code: { in: ANALYSIS_LEAGUES }, isActive: true },
    include: {
      teams: {
        include: { seasonStats: true },
        orderBy: { seasonStats: { rank: 'asc' } },
        take: 5,
      },
    },
  })

  if (leagues.length > 0) {
    const randomLeague = leagues[Math.floor(Math.random() * leagues.length)]
    topics.push({
      topic: `${randomLeague.name} 시즌 중간 점검`,
      data: {
        type: 'league_review',
        league: randomLeague.name,
        topTeams: randomLeague.teams.map((t) => ({
          name: t.name,
          rank: t.seasonStats?.rank,
          points: t.seasonStats?.points,
          wins: t.seasonStats?.wins,
          draws: t.seasonStats?.draws,
          losses: t.seasonStats?.losses,
        })),
      },
    })
  }

  return topics
}

/**
 * GET /api/cron/generate-blog-analysis
 * 크론: 심층 분석 글 자동 생성 (DRAFT)
 * - 주간 자동: 팀 비교, 리그 점검
 * - 수동 트리거: topic 파라미터로 특정 주제 지정 가능
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
  const results: { topic: string; slug?: string; success: boolean; error?: string }[] = []

  // URL 파라미터에서 커스텀 주제 확인
  const url = new URL(request.url)
  const customTopic = url.searchParams.get('topic')
  const customData = url.searchParams.get('data')

  try {
    let topics: { topic: string; data: object }[] = []

    if (customTopic) {
      // 수동 트리거: 커스텀 주제
      topics = [{
        topic: customTopic,
        data: customData ? JSON.parse(customData) : { type: 'custom', topic: customTopic },
      }]
    } else {
      // 자동 생성: 주간 주제
      topics = await generateWeeklyTopics(prisma)
    }

    if (topics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No topics to analyze',
        duration: `${Date.now() - startTime}ms`,
        results: [],
      })
    }

    // 최대 1개만 생성 (API 비용 절감)
    const topic = topics[0]

    try {
      // AI 호출
      const prompt = fillPrompt(BLOG_ANALYSIS_PROMPT, {
        analysisData: JSON.stringify(topic.data, null, 2),
      })

      const completion = await openai.chat.completions.create({
        model: AI_MODELS.ANALYSIS,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.8,
      })

      const aiResponse = completion.choices[0]?.message?.content
      if (!aiResponse) {
        results.push({ topic: topic.topic, success: false, error: 'Empty AI response' })
      } else {
        const blogContent = parseResponse(aiResponse)
        if (!blogContent) {
          results.push({ topic: topic.topic, success: false, error: 'Failed to parse response' })
        } else {
          const slug = generateSlug(topic.topic)

          const newPost = await prisma.blogPost.create({
            data: {
              slug,
              category: 'ANALYSIS',
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
            console.error(`Failed to translate blog analysis ${slug}:`, err)
          })

          revalidateTag('blog')
          results.push({ topic: topic.topic, slug, success: true })
        }
      }
    } catch (error) {
      console.error(`Error generating analysis for topic ${topic.topic}:`, error)
      results.push({
        topic: topic.topic,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    const duration = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount} analysis posts`,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('Blog analysis generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
