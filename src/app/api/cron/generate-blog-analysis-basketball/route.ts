import { NextResponse } from 'next/server'
import { openai, AI_MODELS } from '@/lib/openai'
import { BLOG_ANALYSIS_PROMPT_BASKETBALL, fillPrompt } from '@/lib/ai/prompts'
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
function generateSlug(topic: string): string {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 50)
  const timestamp = Date.now().toString(36)
  return `nba-${normalize(topic)}-analysis-${timestamp}`
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
 * NBA 분석 주제 생성
 */
async function generateNBATopics(prisma: PrismaClient): Promise<{ topic: string; data: object }[]> {
  const topics: { topic: string; data: object }[] = []

  // NBA 상위권 팀 조회
  const topTeams = await prisma.team.findMany({
    where: {
      sportType: 'BASKETBALL',
      seasonStats: { rank: { lte: 10 } },
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
          conference: team1.league?.name,
          rank: team1.seasonStats?.rank,
          wins: team1.seasonStats?.wins,
          losses: team1.seasonStats?.losses,
          avgScored: team1.seasonStats?.avgScored,
          avgAllowed: team1.seasonStats?.avgAllowed,
        },
        team2: {
          name: team2.name,
          conference: team2.league?.name,
          rank: team2.seasonStats?.rank,
          wins: team2.seasonStats?.wins,
          losses: team2.seasonStats?.losses,
          avgScored: team2.seasonStats?.avgScored,
          avgAllowed: team2.seasonStats?.avgAllowed,
        },
      },
    })
  }

  // 컨퍼런스별 시즌 점검
  const conferences = await prisma.league.findMany({
    where: {
      sportType: 'BASKETBALL',
      isActive: true,
    },
    include: {
      teams: {
        include: { seasonStats: true },
        orderBy: { seasonStats: { rank: 'asc' } },
        take: 8,
      },
    },
  })

  if (conferences.length > 0) {
    const randomConf = conferences[Math.floor(Math.random() * conferences.length)]
    topics.push({
      topic: `${randomConf.name} 시즌 중간 점검`,
      data: {
        type: 'conference_review',
        conference: randomConf.name,
        topTeams: randomConf.teams.map((t) => ({
          name: t.name,
          rank: t.seasonStats?.rank,
          wins: t.seasonStats?.wins,
          losses: t.seasonStats?.losses,
          avgScored: t.seasonStats?.avgScored,
        })),
      },
    })
  }

  return topics
}

/**
 * GET /api/cron/generate-blog-analysis-basketball
 * 크론: NBA 심층 분석 글 자동 생성 (DRAFT)
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
      topics = [{
        topic: customTopic,
        data: customData ? JSON.parse(customData) : { type: 'custom', topic: customTopic },
      }]
    } else {
      topics = await generateNBATopics(prisma)
    }

    if (topics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No NBA topics to analyze',
        duration: `${Date.now() - startTime}ms`,
        results: [],
      })
    }

    // 최대 1개만 생성
    const topic = topics[0]

    try {
      const prompt = fillPrompt(BLOG_ANALYSIS_PROMPT_BASKETBALL, {
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

          await prisma.blogPost.create({
            data: {
              slug,
              category: 'ANALYSIS',
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
          results.push({ topic: topic.topic, slug, success: true })
        }
      }
    } catch (error) {
      console.error(`Error generating NBA analysis for topic ${topic.topic}:`, error)
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
      message: `Generated ${successCount} NBA analysis posts`,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    console.error('NBA blog analysis generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
