import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

// 팀 이름 정규화 (검색용)
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '') // 특수문자 제거
    .replace(/fc|cf|sc|afc|ac|as|ss|ssc/gi, '') // 팀 접미사 제거
    .trim()
}

// 슬러그에서 팀 이름 추출
function extractTeamNamesFromSlug(slug: string): { home: string; away: string } | null {
  // 패턴: "team1-vs-team2-preview-xxx" 또는 "team1-vs-team2-review-xxx"
  const vsMatch = slug.match(/^(.+?)-vs-(.+?)-(preview|review|analysis)/i)
  if (vsMatch) {
    return {
      home: vsMatch[1].replace(/-/g, ' ').trim(),
      away: vsMatch[2].replace(/-/g, ' ').trim(),
    }
  }
  return null
}

/**
 * POST /api/admin/link-posts-to-matches
 * 기존 블로그 포스트를 경기 데이터와 연결
 */
export async function POST() {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    // matchId가 없는 PREVIEW/REVIEW 포스트 조회
    const unlinkedPosts = await prisma.blogPost.findMany({
      where: {
        matchId: null,
        category: { in: ['PREVIEW', 'REVIEW'] },
      },
      select: {
        id: true,
        slug: true,
        category: true,
        sportType: true,
        translations: true,
        createdAt: true,
      },
    })

    const results: Array<{
      postId: string
      slug: string
      status: 'linked' | 'not_found' | 'error'
      matchId?: string
      message?: string
    }> = []

    // 모든 팀 조회 (캐싱)
    const allTeams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        sportType: true,
      },
    })

    // 팀 이름 맵 생성 (정규화된 이름 -> 팀 ID)
    const teamNameMap = new Map<string, { id: string; sportType: string }>()
    for (const team of allTeams) {
      teamNameMap.set(normalizeTeamName(team.name), { id: team.id, sportType: team.sportType })
      if (team.shortName) {
        teamNameMap.set(normalizeTeamName(team.shortName), { id: team.id, sportType: team.sportType })
      }
    }

    for (const post of unlinkedPosts) {
      try {
        // 슬러그에서 팀 이름 추출
        const teamNames = extractTeamNamesFromSlug(post.slug)
        if (!teamNames) {
          results.push({
            postId: post.id,
            slug: post.slug,
            status: 'not_found',
            message: '슬러그에서 팀 이름을 추출할 수 없음',
          })
          continue
        }

        // 팀 찾기
        const homeNormalized = normalizeTeamName(teamNames.home)
        const awayNormalized = normalizeTeamName(teamNames.away)

        const homeTeam = teamNameMap.get(homeNormalized)
        const awayTeam = teamNameMap.get(awayNormalized)

        if (!homeTeam || !awayTeam) {
          results.push({
            postId: post.id,
            slug: post.slug,
            status: 'not_found',
            message: `팀을 찾을 수 없음: ${!homeTeam ? teamNames.home : ''} ${!awayTeam ? teamNames.away : ''}`,
          })
          continue
        }

        // 해당 팀들의 경기 찾기 (생성일 기준 ±7일)
        const postDate = new Date(post.createdAt)
        const startDate = new Date(postDate)
        startDate.setDate(startDate.getDate() - 7)
        const endDate = new Date(postDate)
        endDate.setDate(endDate.getDate() + 7)

        const match = await prisma.match.findFirst({
          where: {
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            kickoffAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            kickoffAt: post.category === 'PREVIEW' ? 'asc' : 'desc',
          },
        })

        if (!match) {
          results.push({
            postId: post.id,
            slug: post.slug,
            status: 'not_found',
            message: `경기를 찾을 수 없음: ${teamNames.home} vs ${teamNames.away}`,
          })
          continue
        }

        // 포스트에 matchId 연결
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { matchId: match.id },
        })

        results.push({
          postId: post.id,
          slug: post.slug,
          status: 'linked',
          matchId: match.id,
        })
      } catch (error) {
        results.push({
          postId: post.id,
          slug: post.slug,
          status: 'error',
          message: String(error),
        })
      }
    }

    const linked = results.filter(r => r.status === 'linked').length
    const notFound = results.filter(r => r.status === 'not_found').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: true,
      summary: {
        total: unlinkedPosts.length,
        linked,
        notFound,
        errors,
      },
      results,
    })
  } catch (error) {
    console.error('Failed to link posts to matches:', error)
    return NextResponse.json(
      { error: '연결 작업 실패', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/link-posts-to-matches
 * 연결되지 않은 포스트 현황 조회
 */
export async function GET() {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    const unlinkedCount = await prisma.blogPost.count({
      where: {
        matchId: null,
        category: { in: ['PREVIEW', 'REVIEW'] },
      },
    })

    const linkedCount = await prisma.blogPost.count({
      where: {
        matchId: { not: null },
      },
    })

    return NextResponse.json({
      unlinked: unlinkedCount,
      linked: linkedCount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: '조회 실패', details: String(error) },
      { status: 500 }
    )
  }
}
