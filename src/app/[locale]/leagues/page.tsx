import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Globe, TrendingUp } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })

  return {
    title: t('leagues'),
    description: 'Browse football leagues with AI-powered analysis',
  }
}

// 무료 지원 리그 (Football-Data.org)
const FREE_LEAGUES = [
  { code: 'PL', name: 'Premier League', country: 'England', slug: 'epl' },
  { code: 'PD', name: 'La Liga', country: 'Spain', slug: 'laliga' },
  { code: 'SA', name: 'Serie A', country: 'Italy', slug: 'serie-a' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany', slug: 'bundesliga' },
  { code: 'FL1', name: 'Ligue 1', country: 'France', slug: 'ligue1' },
  { code: 'CL', name: 'Champions League', country: 'Europe', slug: 'ucl' },
  { code: 'DED', name: 'Eredivisie', country: 'Netherlands', slug: 'eredivisie' },
  { code: 'PPL', name: 'Primeira Liga', country: 'Portugal', slug: 'primeira-liga' },
]

interface LeagueData {
  code: string
  name: string
  country: string
  slug: string
  logoUrl?: string | null
  teamCount: number
  currentMatchday?: number | null
}

async function getLeaguesFromDB(): Promise<LeagueData[]> {
  try {
    const dbLeagues = await prisma.league.findMany({
      where: {
        sportType: 'FOOTBALL',
        isActive: true,
      },
      include: {
        _count: {
          select: { teams: true },
        },
      },
    })

    // DB 리그와 FREE_LEAGUES 매핑
    return FREE_LEAGUES.map((freeLeague) => {
      const dbLeague = dbLeagues.find((l) => l.code === freeLeague.code)
      return {
        code: freeLeague.code,
        name: dbLeague?.name || freeLeague.name,
        country: dbLeague?.country || freeLeague.country,
        slug: freeLeague.slug,
        logoUrl: dbLeague?.logoUrl,
        teamCount: dbLeague?._count.teams || 0,
        currentMatchday: dbLeague?.currentMatchday,
      }
    })
  } catch {
    // DB 연결 실패시 기본 데이터 반환
    return FREE_LEAGUES.map((l) => ({
      ...l,
      teamCount: 0,
    }))
  }
}

// 챔피언스리그 로고 URL (Football-Data.org에서 제공하지 않는 경우 대체)
const LEAGUE_LOGOS: Record<string, string> = {
  CL: 'https://crests.football-data.org/CL.png',
}

interface LeagueCardProps {
  league: LeagueData
  translations: {
    round: string
    teams: string
  }
}

function LeagueCard({ league, translations }: LeagueCardProps) {
  const logoUrl = league.logoUrl || LEAGUE_LOGOS[league.code]

  return (
    <Link href={`/league/${league.slug}`}>
      <Card className="transition-all hover:shadow-md hover:border-primary/50">
        <CardContent className="flex items-center p-4">
          <div className="mr-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white overflow-hidden p-2">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={league.name}
                width={40}
                height={40}
                className="object-contain"
              />
            ) : (
              <Trophy className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{league.name}</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center">
                <Globe className="mr-1 h-3 w-3" />
                {league.country}
              </span>
              {league.currentMatchday && (
                <span className="flex items-center">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {translations.round} {league.currentMatchday}
                </span>
              )}
            </div>
          </div>
          {league.teamCount > 0 && (
            <Badge variant="secondary">{league.teamCount} {translations.teams}</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function LeaguesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'league' })
  const leagues = await getLeaguesFromDB()

  const translations = {
    round: t('round'),
    teams: t('teams'),
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">{t('page_title')}</h1>
        <p className="text-muted-foreground">
          {t('page_description')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {leagues.map((league) => (
          <LeagueCard key={league.code} league={league} translations={translations} />
        ))}
      </div>

    </div>
  )
}
