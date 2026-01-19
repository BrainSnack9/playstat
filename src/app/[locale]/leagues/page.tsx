import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Globe, TrendingUp } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import { SPORT_COOKIE, getSportFromCookie, sportIdToEnum } from '@/lib/sport'

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

// 축구 리그 slug 매핑 (기존 호환성 유지)
const FOOTBALL_LEAGUE_SLUGS: Record<string, string> = {
  PL: 'epl',
  PD: 'laliga',
  SA: 'serie-a',
  BL1: 'bundesliga',
  FL1: 'ligue1',
  CL: 'ucl',
  DED: 'eredivisie',
  PPL: 'primeira-liga',
}

interface LeagueData {
  id: string
  code: string
  name: string
  country: string
  slug: string
  logoUrl?: string | null
  teamCount: number
  currentMatchday?: number | null
}

async function getLeaguesFromDB(sportType: 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'): Promise<LeagueData[]> {
  try {
    const dbLeagues = await prisma.league.findMany({
      where: {
        sportType,
        isActive: true,
      },
      include: {
        _count: {
          select: { teams: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return dbLeagues.map((league) => ({
      id: league.id,
      code: league.code || '',
      name: league.name,
      country: league.country,
      slug: league.code ? (FOOTBALL_LEAGUE_SLUGS[league.code] || league.code.toLowerCase()) : league.id,
      logoUrl: league.logoUrl,
      teamCount: league._count.teams,
      currentMatchday: league.currentMatchday,
    }))
  } catch {
    return []
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

  // 쿠키에서 스포츠 타입 가져오기
  const cookieStore = await cookies()
  const sportType = sportIdToEnum(getSportFromCookie(cookieStore.get(SPORT_COOKIE)?.value))

  const t = await getTranslations({ locale, namespace: 'league' })
  const leagues = await getLeaguesFromDB(sportType)

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
