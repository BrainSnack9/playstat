import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/teams/[id]
 * 팀 상세 정보 조회 (DB에서만 읽기)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            country: true,
            sportType: true,
          },
        },
        players: {
          select: {
            id: true,
            name: true,
            position: true,
            number: true,
            nationality: true,
            photoUrl: true,
          },
          orderBy: {
            number: 'asc',
          },
        },
        seasonStats: true,
        recentMatches: true,
      },
    })

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // 다가오는 경기 조회
    const upcomingMatches = await prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: id }, { awayTeamId: id }],
        kickoffAt: { gte: new Date() },
        status: 'SCHEDULED',
      },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true } },
        awayTeam: { select: { id: true, name: true, shortName: true } },
        league: { select: { name: true } },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 5,
    })

    // 최근 경기 결과 조회
    const recentResults = await prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: id }, { awayTeamId: id }],
        status: 'FINISHED',
      },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true } },
        awayTeam: { select: { id: true, name: true, shortName: true } },
        league: { select: { name: true } },
      },
      orderBy: { kickoffAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        sportType: team.sportType,
        founded: team.founded,
        venue: team.venue,
        city: team.city,
        league: team.league,
        players: team.players,
        seasonStats: team.seasonStats,
        recentForm: team.recentMatches?.recentForm,
        recentMatches: team.recentMatches?.matchesJson,
        upcomingMatches: upcomingMatches.map((m) => ({
          id: m.id,
          slug: m.slug,
          opponent: m.homeTeamId === id ? m.awayTeam : m.homeTeam,
          isHome: m.homeTeamId === id,
          kickoffAt: m.kickoffAt.toISOString(),
          league: m.league.name,
        })),
        recentResults: recentResults.map((m) => ({
          id: m.id,
          slug: m.slug,
          opponent: m.homeTeamId === id ? m.awayTeam : m.homeTeam,
          isHome: m.homeTeamId === id,
          score: `${m.homeScore}-${m.awayScore}`,
          result:
            m.homeTeamId === id
              ? m.homeScore! > m.awayScore!
                ? 'W'
                : m.homeScore! < m.awayScore!
                ? 'L'
                : 'D'
              : m.awayScore! > m.homeScore!
              ? 'W'
              : m.awayScore! < m.homeScore!
              ? 'L'
              : 'D',
          kickoffAt: m.kickoffAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team' },
      { status: 500 }
    )
  }
}
