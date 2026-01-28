import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { SportType, MatchStatus } from '@prisma/client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 빅매치 대상 리그
const BIG_MATCH_LEAGUES: Record<SportType, string[]> = {
  FOOTBALL: ['PL', 'PD', 'SA', 'BL1', 'FL1'],
  BASKETBALL: ['NBA'],
  BASEBALL: ['MLB', 'KBO'],
}

// 빅매치 상위 순위 기준
const TOP_RANK_THRESHOLD: Record<SportType, number> = {
  FOOTBALL: 15,
  BASKETBALL: 10,
  BASEBALL: 10,
}

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

/**
 * GET /api/admin/blog/available-matches
 * 프리뷰 생성 가능한 경기 목록 조회
 */
export async function GET(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sportType = (searchParams.get('sport') || 'FOOTBALL') as SportType
  const category = searchParams.get('category') || 'PREVIEW' // PREVIEW or REVIEW

  try {
    const leagues = BIG_MATCH_LEAGUES[sportType] || []
    const rankThreshold = TOP_RANK_THRESHOLD[sportType] || 10

    // 최근 10경기 조회 (예정 경기 또는 완료 경기)
    const statusValues: MatchStatus[] = category === 'PREVIEW'
      ? [MatchStatus.SCHEDULED, MatchStatus.TIMED]
      : [MatchStatus.FINISHED]

    const matches = await prisma.match.findMany({
      where: {
        sportType,
        status: { in: statusValues },
        league: {
          code: { in: leagues },
        },
      },
      include: {
        league: true,
        homeTeam: {
          include: { seasonStats: true },
        },
        awayTeam: {
          include: { seasonStats: true },
        },
      },
      orderBy: category === 'PREVIEW'
        ? { kickoffAt: 'asc' }
        : { kickoffAt: 'desc' },
      take: 30,
    })

    // 빅매치 필터링 (양 팀 모두 상위권)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bigMatches = matches.filter((match: any) => {
      const homeRank = match.homeTeam?.seasonStats?.rank
      const awayRank = match.awayTeam?.seasonStats?.rank

      // 순위 정보가 있으면 상위권만 필터링
      if (homeRank && awayRank) {
        return homeRank <= rankThreshold && awayRank <= rankThreshold
      }

      // 순위 정보가 없으면 일단 포함 (수동으로 선택할 수 있도록)
      return true
    }).slice(0, 15)

    // 이미 생성된 포스트 확인
    const matchIds = bigMatches.map(m => m.id)

    // 슬러그 패턴으로 기존 포스트 찾기
    const existingPosts = await prisma.blogPost.findMany({
      where: {
        sportType,
        category: category as 'PREVIEW' | 'REVIEW',
      },
      select: { slug: true },
    })

    const existingSlugs = existingPosts.map(p => p.slug.toLowerCase())

    // 각 경기에 대해 포스트 존재 여부 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const availableMatches = bigMatches.map((match: any) => {
      const homeTeamName = match.homeTeam?.name || ''
      const awayTeamName = match.awayTeam?.name || ''

      // 슬러그 패턴으로 중복 확인
      const slugPattern = `${homeTeamName.toLowerCase().replace(/\s+/g, '-')}-vs-${awayTeamName.toLowerCase().replace(/\s+/g, '-')}`.substring(0, 40)
      const hasExisting = existingSlugs.some(s => s.includes(slugPattern.substring(0, 20)))

      return {
        id: match.id,
        homeTeam: {
          name: homeTeamName,
          rank: match.homeTeam?.seasonStats?.rank,
          points: match.homeTeam?.seasonStats?.points,
        },
        awayTeam: {
          name: awayTeamName,
          rank: match.awayTeam?.seasonStats?.rank,
          points: match.awayTeam?.seasonStats?.points,
        },
        league: {
          name: match.league?.name,
          code: match.league?.code,
        },
        kickoffAt: match.kickoffAt,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        hasExistingPost: hasExisting,
      }
    })

    return NextResponse.json({
      matches: availableMatches,
      total: availableMatches.length,
      sportType,
      category,
    })
  } catch (error) {
    console.error('Failed to fetch available matches:', error)
    return NextResponse.json(
      { error: '경기 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
