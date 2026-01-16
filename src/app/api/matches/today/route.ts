import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, startOfDay, endOfDay } from 'date-fns'

/**
 * GET /api/matches/today
 * 오늘의 경기 목록 조회 (DB에서만 읽기 - 유저 접속 시)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sportType = searchParams.get('sport') || 'FOOTBALL'
    const dateParam = searchParams.get('date')

    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const dayStart = startOfDay(targetDate)
    const dayEnd = endOfDay(targetDate)

    // DB에서 경기 목록 조회 (API 호출 없음)
    const matches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        sportType: sportType as 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL',
      },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            country: true,
          },
        },
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        matchAnalysis: {
          select: {
            id: true,
            summary: true,
          },
        },
      },
      orderBy: {
        kickoffAt: 'asc',
      },
    })

    // 응답 포맷팅
    const formattedMatches = matches.map((match) => ({
      id: match.id,
      slug: match.slug,
      league: match.league,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoffAt: match.kickoffAt.toISOString(),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      venue: match.venue,
      round: match.round,
      hasAnalysis: !!match.matchAnalysis,
    }))

    return NextResponse.json({
      success: true,
      date: format(targetDate, 'yyyy-MM-dd'),
      count: matches.length,
      matches: formattedMatches,
    })
  } catch (error) {
    console.error('Error fetching today matches:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch matches' },
      { status: 500 }
    )
  }
}
