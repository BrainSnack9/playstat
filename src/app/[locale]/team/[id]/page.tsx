import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Trophy,
  Calendar,
  MapPin,
  TrendingUp,
  Building,
  Clock,
  Target,
  Shield,
  Users,
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { CACHE_REVALIDATE } from '@/lib/cache'
import { generateMetadata as buildMetadata, generateTeamSEO, generateTeamJsonLd } from '@/lib/seo'
import { FormBadge } from '@/components/form-badge'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export const revalidate = CACHE_REVALIDATE

async function getTeamData(id: string) {
  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        league: true,
        seasonStats: true,
        recentMatches: true,
        players: {
          orderBy: [
            { position: 'asc' },
            { shirtNumber: 'asc' },
          ],
        },
        homeMatches: {
          where: {
            kickoffAt: { gte: new Date() },
          },
          include: {
            awayTeam: true,
            league: true,
            matchAnalysis: true,
          },
          orderBy: { kickoffAt: 'asc' },
          take: 5,
        },
        awayMatches: {
          where: {
            kickoffAt: { gte: new Date() },
          },
          include: {
            homeTeam: true,
            league: true,
            matchAnalysis: true,
          },
          orderBy: { kickoffAt: 'asc' },
          take: 5,
        },
      },
    })

    return team
  } catch {
    return null
  }
}

type TeamWithRelations = NonNullable<Awaited<ReturnType<typeof getTeamData>>>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const team = await getTeamData(id)

  if (!team) {
    return { title: 'Team Not Found' }
  }

  const recentForm = team.seasonStats?.form || team.recentMatches?.recentForm
  const localeCode = (await params).locale === 'ko' ? 'ko_KR' : 'en_US'

  return buildMetadata(
    generateTeamSEO({
      name: team.name,
      league: team.league.name,
      recentForm,
      locale: localeCode,
    })
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-primary',
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg bg-primary/10 p-2 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function TeamPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const team = await getTeamData(id)

  if (!team) {
    notFound()
  }

  const stats = team.seasonStats
  const recentMatches = team.recentMatches?.matchesJson as
    | Array<{
        date: string
        opponent: string
        opponentCrest?: string
        result: string
        score: string
        isHome: boolean
        competition?: string
      }>
    | undefined

  // 홈/원정 경기 합치기
  const upcomingMatches = [
    ...team.homeMatches.map((m) => ({
      ...m,
      isHome: true,
      opponent: m.awayTeam,
    })),
    ...team.awayMatches.map((m) => ({
      ...m,
      isHome: false,
      opponent: m.homeTeam,
    })),
  ].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())

  // JSON-LD structured data
  const jsonLd = generateTeamJsonLd({
    name: team.name,
    logoUrl: team.logoUrl || undefined,
    venue: team.venue || undefined,
    city: team.city || undefined,
    founded: team.founded || undefined,
  })

  return (
    <div className="container py-8">
      {/* Add JSON-LD to the page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Team Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            {team.logoUrl ? (
              <Image
                src={team.logoUrl}
                alt={team.name}
                width={96}
                height={96}
                className="rounded-lg"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <span className="text-3xl font-bold">{team.tla || team.shortName}</span>
              </div>
            )}

            <div className="flex-1 text-center md:text-left">
              <Link
                href={`/league/${team.league.code?.toLowerCase() || 'epl'}`}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                <Trophy className="mr-1 inline h-4 w-4" />
                {team.league.name}
              </Link>
              <h1 className="text-3xl font-bold">{team.name}</h1>

              <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground md:justify-start">
                {team.founded && (
                  <div className="flex items-center">
                    <Building className="mr-1 h-4 w-4" />
                    {team.founded}년 창단
                  </div>
                )}
                {team.venue && (
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    {team.venue}
                  </div>
                )}
                {team.city && (
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    {team.city}
                  </div>
                )}
              </div>
            </div>

            {stats && (
              <div className="text-center">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {stats.rank}위
                  </Badge>
                  <Badge className="text-lg px-3 py-1">{stats.points}점</Badge>
                </div>
                <p className="mb-2 text-sm text-muted-foreground">최근 폼</p>
                <FormBadge form={stats.form || team.recentMatches?.recentForm || null} size="lg" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="stats" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stats">시즌 통계</TabsTrigger>
          <TabsTrigger value="squad">선수단</TabsTrigger>
          <TabsTrigger value="recent">최근 경기</TabsTrigger>
          <TabsTrigger value="fixtures">경기 일정</TabsTrigger>
        </TabsList>

        {/* Stats */}
        <TabsContent value="stats">
          {stats ? (
            <div className="space-y-6">
              {/* 기본 통계 */}
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard label="경기" value={stats.gamesPlayed} icon={Calendar} />
                <StatCard label="승" value={stats.wins} icon={TrendingUp} color="text-green-500" />
                <StatCard label="무" value={stats.draws || 0} icon={Target} color="text-gray-500" />
                <StatCard label="패" value={stats.losses} icon={Shield} color="text-red-500" />
              </div>

              {/* 승률 & 득실점 */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* 승률 분석 */}
                <Card>
                  <CardHeader>
                    <CardTitle>승률 분석</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 승/무/패 바 */}
                      <div className="flex h-4 overflow-hidden rounded-full">
                        <div
                          className="bg-green-500"
                          style={{ width: `${(stats.wins / stats.gamesPlayed) * 100}%` }}
                        />
                        <div
                          className="bg-gray-400"
                          style={{ width: `${((stats.draws || 0) / stats.gamesPlayed) * 100}%` }}
                        />
                        <div
                          className="bg-red-500"
                          style={{ width: `${(stats.losses / stats.gamesPlayed) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-500">
                          승 {((stats.wins / stats.gamesPlayed) * 100).toFixed(0)}%
                        </span>
                        <span className="text-gray-500">
                          무 {(((stats.draws || 0) / stats.gamesPlayed) * 100).toFixed(0)}%
                        </span>
                        <span className="text-red-500">
                          패 {((stats.losses / stats.gamesPlayed) * 100).toFixed(0)}%
                        </span>
                      </div>
                      {/* 세부 지표 */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">경기당 득점</p>
                          <p className="text-2xl font-bold">
                            {((stats.goalsFor || 0) / stats.gamesPlayed).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">경기당 실점</p>
                          <p className="text-2xl font-bold">
                            {((stats.goalsAgainst || 0) / stats.gamesPlayed).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 득실점 */}
                <Card>
                  <CardHeader>
                    <CardTitle>득실점</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 득점 바 */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">득점</span>
                          <span className="font-bold text-green-600">{stats.goalsFor || 0}</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${Math.min(((stats.goalsFor || 0) / Math.max(stats.goalsFor || 0, stats.goalsAgainst || 0, 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {/* 실점 바 */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-muted-foreground">실점</span>
                          <span className="font-bold text-red-600">{stats.goalsAgainst || 0}</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{
                              width: `${Math.min(((stats.goalsAgainst || 0) / Math.max(stats.goalsFor || 0, stats.goalsAgainst || 0, 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {/* 골득실 */}
                      <div className="pt-4 border-t text-center">
                        <p className="text-sm text-muted-foreground">골득실</p>
                        <p className={`text-3xl font-bold ${(stats.goalDifference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(stats.goalDifference || 0) > 0 ? '+' : ''}
                          {stats.goalDifference || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">시즌 통계 데이터가 없습니다.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  크론 작업을 실행하여 팀 데이터를 수집해주세요.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Squad */}
        <TabsContent value="squad">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                선수단
                {team.players.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({team.players.length}명)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {team.players.length > 0 ? (
                <div className="space-y-6">
                  {/* 포지션별 그룹화 */}
                  {(['Goalkeeper', 'Defence', 'Midfield', 'Offence'] as const).map((positionGroup) => {
                    // 세부 포지션을 그룹으로 매핑
                    const positionMapping: Record<string, string[]> = {
                      Goalkeeper: ['Goalkeeper'],
                      Defence: ['Defence', 'Centre-Back', 'Left-Back', 'Right-Back'],
                      Midfield: ['Midfield', 'Central Midfield', 'Attacking Midfield', 'Defensive Midfield', 'Left Midfield', 'Right Midfield'],
                      Offence: ['Offence', 'Centre-Forward', 'Left Winger', 'Right Winger', 'Second Striker', 'Striker'],
                    }

                    const positionPlayers = team.players.filter((p) =>
                      positionMapping[positionGroup]?.includes(p.position || '')
                    )
                    if (positionPlayers.length === 0) return null

                    const positionLabels: Record<string, string> = {
                      Goalkeeper: '골키퍼',
                      Defence: '수비수',
                      Midfield: '미드필더',
                      Offence: '공격수',
                    }

                    return (
                      <div key={positionGroup}>
                        <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full ${
                              positionGroup === 'Goalkeeper'
                                ? 'bg-yellow-500'
                                : positionGroup === 'Defence'
                                ? 'bg-blue-500'
                                : positionGroup === 'Midfield'
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          {positionLabels[positionGroup]}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({positionPlayers.length})
                          </span>
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {positionPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {player.shirtNumber && (
                                    <span className="text-muted-foreground mr-2">#{player.shirtNumber}</span>
                                  )}
                                  {player.name}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {player.nationality}
                                  {player.birthDate && (
                                    <> · {new Date().getFullYear() - new Date(player.birthDate).getFullYear()}세</>
                                  )}
                                </p>
                              </div>
                              {player.marketValue && (
                                <Badge variant="outline" className="shrink-0">
                                  €{(player.marketValue / 1000000).toFixed(1)}M
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  선수 데이터가 없습니다.
                  <br />
                  <span className="text-sm">크론 작업을 실행하여 선수 데이터를 수집해주세요.</span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Matches */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>최근 경기 결과</CardTitle>
            </CardHeader>
            <CardContent>
              {recentMatches && recentMatches.length > 0 ? (
                <div className="space-y-3">
                  {recentMatches.slice(0, 10).map((match, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={match.isHome ? 'default' : 'outline'}
                          className="w-12 justify-center"
                        >
                          {match.isHome ? '홈' : '원정'}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {match.opponentCrest && (
                            <Image
                              src={match.opponentCrest}
                              alt={match.opponent}
                              width={24}
                              height={24}
                              className="rounded"
                            />
                          )}
                          <span className="font-medium">{match.opponent}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{match.score}</span>
                        <span
                          className={`w-8 h-8 flex items-center justify-center rounded text-white font-bold ${
                            match.result === 'W'
                              ? 'bg-green-500'
                              : match.result === 'D'
                              ? 'bg-gray-400'
                              : 'bg-red-500'
                          }`}
                        >
                          {match.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  최근 경기 데이터가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixtures */}
        <TabsContent value="fixtures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                예정 경기
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMatches.length > 0 ? (
                <div className="space-y-4">
                  {upcomingMatches.map((match) => (
                    <Link key={match.id} href={`/match/${match.slug}`}>
                      <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted">
                        <div className="flex items-center gap-4">
                          <Badge variant={match.isHome ? 'default' : 'outline'}>
                            {match.isHome ? '홈' : '원정'}
                          </Badge>
                          <div className="flex items-center gap-2">
                            {match.opponent.logoUrl && (
                              <Image
                                src={match.opponent.logoUrl}
                                alt={match.opponent.name}
                                width={28}
                                height={28}
                                className="rounded"
                              />
                            )}
                            <span className="font-medium">vs {match.opponent.name}</span>
                          </div>
                          {match.matchAnalysis && (
                            <Badge variant="outline" className="text-xs">
                              AI 분석
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Clock className="mr-1 h-4 w-4" />
                            {format(new Date(match.kickoffAt), 'M월 d일 HH:mm', { locale: ko })}
                          </div>
                          <Badge className="bg-blue-500">예정</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  예정된 경기가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
