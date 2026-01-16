import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/matches/[id]
 * 특정 경기 상세 조회 (DB에서만 읽기)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        league: true,
        homeTeam: {
          include: {
            seasonStats: true,
            recentMatches: true,
          },
        },
        awayTeam: {
          include: {
            seasonStats: true,
            recentMatches: true,
          },
        },
        matchStats: true,
        matchAnalysis: true,
      },
    })

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      )
    }

    // 상대전적 조회
    const h2h = await prisma.headToHead.findFirst({
      where: {
        OR: [
          { teamAId: match.homeTeamId, teamBId: match.awayTeamId },
          { teamAId: match.awayTeamId, teamBId: match.homeTeamId },
        ],
      },
    })

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        slug: match.slug,
        sportType: match.sportType,
        league: match.league,
        homeTeam: {
          ...match.homeTeam,
          recentForm: match.homeTeam.recentMatches?.recentForm,
          seasonStats: match.homeTeam.seasonStats,
          recentMatches: match.homeTeam.recentMatches?.matchesJson,
        },
        awayTeam: {
          ...match.awayTeam,
          recentForm: match.awayTeam.recentMatches?.recentForm,
          seasonStats: match.awayTeam.seasonStats,
          recentMatches: match.awayTeam.recentMatches?.matchesJson,
        },
        kickoffAt: match.kickoffAt.toISOString(),
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        venue: match.venue,
        round: match.round,
        stats: match.matchStats?.statsJson,
        analysis: match.matchAnalysis,
        h2h: h2h?.matchesJson,
      },
    })
  } catch (error) {
    console.error('Error fetching match:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch match' },
      { status: 500 }
    )
  }
}
