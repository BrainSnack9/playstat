import { Link } from '@/i18n/routing'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trophy, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { ko, enUS, ja, de, es, Locale as DateLocale } from 'date-fns/locale'
import Image from 'next/image'

interface MatchCardProps {
  match: {
    id: string
    slug: string | null
    status: string
    kickoffAt: Date | string
    homeScore: number | null
    awayScore: number | null
    sportType: string
    homeTeam: {
      name: string
      shortName: string | null
      logoUrl: string | null
    }
    awayTeam: {
      name: string
      shortName: string | null
      logoUrl: string | null
    }
    league: {
      name: string
      logoUrl: string | null
    }
  }
  locale: string
  title?: string
}

const dateLocales: Record<string, DateLocale> = {
  ko,
  en: enUS,
  ja,
  de,
  es,
}

const sportPaths: Record<string, string> = {
  FOOTBALL: 'football',
  BASKETBALL: 'basketball',
  BASEBALL: 'baseball',
}

const defaultTitles: Record<string, string> = {
  ko: '관련 경기',
  en: 'Related Match',
  ja: '関連試合',
  de: 'Zugehöriges Spiel',
  es: 'Partido Relacionado',
}

const viewMatchTexts: Record<string, string> = {
  ko: '경기 분석 보기',
  en: 'View Match Analysis',
  ja: '試合分析を見る',
  de: 'Spielanalyse ansehen',
  es: 'Ver Análisis del Partido',
}

export function MatchCard({ match, locale, title }: MatchCardProps) {
  const sectionTitle = title || defaultTitles[locale] || defaultTitles.en
  const viewText = viewMatchTexts[locale] || viewMatchTexts.en
  const sportPath = sportPaths[match.sportType] || 'football'

  const isFinished = match.status === 'FINISHED'
  const kickoffDate = new Date(match.kickoffAt)

  // 승자 결정
  let winner: 'home' | 'away' | 'draw' | null = null
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) winner = 'home'
    else if (match.awayScore > match.homeScore) winner = 'away'
    else winner = 'draw'
  }

  return (
    <Card className="bg-card/50 border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{sectionTitle}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {match.league.logoUrl && (
              <Image
                src={match.league.logoUrl}
                alt={match.league.name}
                width={16}
                height={16}
                className="rounded"
              />
            )}
            <span>{match.league.name}</span>
          </div>
        </div>

        {/* 경기 정보 */}
        <Link
          href={match.slug ? `/${sportPath}/match/${match.slug}` : `/${sportPath}/matches`}
          className="block p-4 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center justify-between">
            {/* 홈팀 */}
            <div className={`flex flex-col items-center flex-1 ${winner === 'away' ? 'opacity-50' : ''}`}>
              {match.homeTeam.logoUrl ? (
                <Image
                  src={match.homeTeam.logoUrl}
                  alt={match.homeTeam.name}
                  width={48}
                  height={48}
                  className="mb-2"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                  <span className="text-xs font-bold">{match.homeTeam.shortName?.slice(0, 3) || match.homeTeam.name.slice(0, 3)}</span>
                </div>
              )}
              <span className="text-sm font-medium text-center line-clamp-1">
                {match.homeTeam.shortName || match.homeTeam.name}
              </span>
            </div>

            {/* 스코어 / 시간 */}
            <div className="flex flex-col items-center px-4">
              {isFinished ? (
                <>
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <span className={winner === 'home' ? 'text-primary' : ''}>
                      {match.homeScore ?? 0}
                    </span>
                    <span className="text-muted-foreground">-</span>
                    <span className={winner === 'away' ? 'text-primary' : ''}>
                      {match.awayScore ?? 0}
                    </span>
                  </div>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {locale === 'ko' ? '종료' : 'FT'}
                  </Badge>
                </>
              ) : (
                <>
                  <span className="text-xl font-bold text-muted-foreground">VS</span>
                  <div className="flex flex-col items-center mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(kickoffDate, 'MMM d', { locale: dateLocales[locale] || enUS })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(kickoffDate, 'HH:mm')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* 원정팀 */}
            <div className={`flex flex-col items-center flex-1 ${winner === 'home' ? 'opacity-50' : ''}`}>
              {match.awayTeam.logoUrl ? (
                <Image
                  src={match.awayTeam.logoUrl}
                  alt={match.awayTeam.name}
                  width={48}
                  height={48}
                  className="mb-2"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                  <span className="text-xs font-bold">{match.awayTeam.shortName?.slice(0, 3) || match.awayTeam.name.slice(0, 3)}</span>
                </div>
              )}
              <span className="text-sm font-medium text-center line-clamp-1">
                {match.awayTeam.shortName || match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* 링크 */}
          <div className="flex items-center justify-center gap-1 mt-4 text-xs text-primary">
            <span>{viewText}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}
