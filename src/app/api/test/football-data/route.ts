import { NextResponse } from 'next/server'
import {
  footballDataApi,
  FREE_COMPETITIONS,
} from '@/lib/api/football-data'
import { format, addDays } from 'date-fns'

/**
 * GET /api/test/football-data
 * Football-Data.org API 테스트 엔드포인트
 *
 * Query params:
 * - action: competitions | standings | matches | team | h2h
 * - code: competition code (e.g., PL, BL1)
 * - teamId: team ID (for team action)
 * - matchId: match ID (for h2h action)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'competitions'
  const code = searchParams.get('code') || FREE_COMPETITIONS.PREMIER_LEAGUE
  const teamId = searchParams.get('teamId')
  const matchId = searchParams.get('matchId')

  try {
    let data: unknown

    switch (action) {
      case 'competitions':
        // 모든 리그 목록
        data = await footballDataApi.getCompetitions()
        break

      case 'competition':
        // 특정 리그 정보
        data = await footballDataApi.getCompetition(code)
        break

      case 'standings':
        // 리그 순위표
        data = await footballDataApi.getStandings(code)
        break

      case 'matches':
        // 리그 경기 목록 (오늘~7일 후)
        const today = format(new Date(), 'yyyy-MM-dd')
        const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')
        data = await footballDataApi.getCompetitionMatches(code, {
          dateFrom: today,
          dateTo: nextWeek,
        })
        break

      case 'todayMatches':
        // 오늘의 모든 경기
        const todayDate = format(new Date(), 'yyyy-MM-dd')
        data = await footballDataApi.getMatchesByDate(todayDate)
        break

      case 'team':
        // 팀 정보
        if (!teamId) {
          return NextResponse.json(
            { error: 'teamId is required for team action' },
            { status: 400 }
          )
        }
        data = await footballDataApi.getTeam(parseInt(teamId))
        break

      case 'teamMatches':
        // 팀 경기 목록
        if (!teamId) {
          return NextResponse.json(
            { error: 'teamId is required for teamMatches action' },
            { status: 400 }
          )
        }
        data = await footballDataApi.getTeamMatches(parseInt(teamId), {
          status: 'FINISHED',
          limit: 10,
        })
        break

      case 'h2h':
        // 상대전적
        if (!matchId) {
          return NextResponse.json(
            { error: 'matchId is required for h2h action' },
            { status: 400 }
          )
        }
        data = await footballDataApi.getHeadToHead(parseInt(matchId), 10)
        break

      case 'scorers':
        // 득점 순위
        data = await footballDataApi.getScorers(code, 10)
        break

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      params: { code, teamId, matchId },
      data,
    })
  } catch (error) {
    console.error('Football-Data API test error:', error)
    return NextResponse.json(
      {
        success: false,
        action,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
