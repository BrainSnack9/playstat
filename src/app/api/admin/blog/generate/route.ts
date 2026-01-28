import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { openai, AI_MODELS } from '@/lib/openai'
import {
  BLOG_PREVIEW_PROMPT,
  BLOG_PREVIEW_PROMPT_BASKETBALL,
  BLOG_REVIEW_PROMPT,
  BLOG_REVIEW_PROMPT_BASKETBALL,
  fillPrompt,
  formatMatchDataForAI,
  type MatchAnalysisInputData,
} from '@/lib/ai/prompts'
import { revalidateTag } from 'next/cache'
import { Prisma, SportType } from '@prisma/client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const SYSTEM_AUTHOR_ID = 'system-auto-generator'

async function verifyAdmin() {
  if (!supabaseUrl || !supabaseAnonKey) return null

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value
    if (!accessToken) return null

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    if (error || !user?.email) return null

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) return null

    return user
  } catch {
    return null
  }
}

function generateSlug(homeTeam: string, awayTeam: string, leagueName: string, category: string): string {
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
  const categorySlug = category.toLowerCase()

  return `${home}-vs-${away}-${league}-${categorySlug}-${timestamp}`
}

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
 * POST /api/admin/blog/generate
 * 특정 경기에 대한 블로그 포스트 생성
 */
export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  if (!openai) {
    return NextResponse.json({ error: 'OpenAI가 설정되지 않았습니다.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { matchId, category = 'PREVIEW' } = body

    if (!matchId) {
      return NextResponse.json({ error: 'matchId가 필요합니다.' }, { status: 400 })
    }

    // 경기 데이터 조회
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        league: true,
        homeTeam: {
          include: { seasonStats: true },
        },
        awayTeam: {
          include: { seasonStats: true },
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: '경기를 찾을 수 없습니다.' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchData = match as any
    const homeTeamName = matchData.homeTeam?.name || ''
    const awayTeamName = matchData.awayTeam?.name || ''
    const leagueName = matchData.league?.name || ''
    const sportType = matchData.sportType as SportType

    // 기존 포스트 확인
    const slugPattern = `${homeTeamName.toLowerCase().replace(/\s+/g, '-')}-vs-${awayTeamName.toLowerCase().replace(/\s+/g, '-')}`.substring(0, 40)
    const existingPost = await prisma.blogPost.findFirst({
      where: {
        slug: { contains: slugPattern.substring(0, 20) },
        category: category as 'PREVIEW' | 'REVIEW',
        sportType,
      },
    })

    if (existingPost) {
      return NextResponse.json({
        error: '이미 이 경기에 대한 포스트가 존재합니다.',
        existingPostId: existingPost.id,
      }, { status: 400 })
    }

    // H2H 데이터 조회
    const h2hRecord = await prisma.headToHead.findFirst({
      where: {
        OR: [
          { teamAId: matchData.homeTeamId, teamBId: matchData.awayTeamId },
          { teamAId: matchData.awayTeamId, teamBId: matchData.homeTeamId },
        ],
      },
    })

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

    // 시즌 스탯
    const homeStats = matchData.homeTeam?.seasonStats
    const awayStats = matchData.awayTeam?.seasonStats

    // AI 입력 데이터 구성
    const inputData: MatchAnalysisInputData = {
      match: {
        sport_type: sportType.toLowerCase() as 'football' | 'basketball' | 'baseball',
        league: leagueName,
        kickoff_at: matchData.kickoffAt?.toISOString() || '',
        home_team: homeTeamName,
        away_team: awayTeamName,
      },
      home: {
        recent_5: [],
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

    // 리뷰인 경우 스코어 추가
    if (category === 'REVIEW') {
      (inputData.match as Record<string, unknown>).home_score = matchData.homeScore
      ;(inputData.match as Record<string, unknown>).away_score = matchData.awayScore
      ;(inputData.match as Record<string, unknown>).result = matchData.homeScore > matchData.awayScore
        ? 'home_win'
        : matchData.homeScore < matchData.awayScore
          ? 'away_win'
          : 'draw'
    }

    // 프롬프트 선택
    let prompt: string
    if (category === 'PREVIEW') {
      prompt = sportType === 'BASKETBALL'
        ? fillPrompt(BLOG_PREVIEW_PROMPT_BASKETBALL, { matchData: formatMatchDataForAI(inputData) })
        : fillPrompt(BLOG_PREVIEW_PROMPT, { matchData: formatMatchDataForAI(inputData) })
    } else {
      prompt = sportType === 'BASKETBALL'
        ? fillPrompt(BLOG_REVIEW_PROMPT_BASKETBALL, { matchData: formatMatchDataForAI(inputData) })
        : fillPrompt(BLOG_REVIEW_PROMPT, { matchData: formatMatchDataForAI(inputData) })
    }

    // AI 호출
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.ANALYSIS,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.8,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'AI 응답이 비어있습니다.' }, { status: 500 })
    }

    const blogContent = parseBlogResponse(aiResponse)
    if (!blogContent) {
      return NextResponse.json({ error: 'AI 응답 파싱에 실패했습니다.' }, { status: 500 })
    }

    // 블로그 포스트 생성
    const slug = generateSlug(homeTeamName, awayTeamName, leagueName, category)

    const post = await prisma.blogPost.create({
      data: {
        slug,
        category: category as 'PREVIEW' | 'REVIEW',
        sportType,
        matchId, // 경기 ID 자동 연결
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

    // 캐시 무효화
    revalidateTag('blog')

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        slug: post.slug,
        title: blogContent.title,
      },
    })
  } catch (error) {
    console.error('Blog generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '블로그 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
