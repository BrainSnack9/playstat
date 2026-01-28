import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, Gamepad2 } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'games' })

  return {
    title: `${t('title')} - PlayStat`,
    description: t('description'),
  }
}

export default async function GamesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'games' })

  const games = [
    {
      id: 'score-challenge',
      href: '/games/score-challenge',
      icon: Target,
      color: 'from-orange-500 to-red-500',
      bgGlow: 'bg-orange-500/20',
      available: true,
    },
    {
      id: 'guess-player',
      href: '/games/guess-player',
      icon: Gamepad2,
      color: 'from-purple-500 to-pink-500',
      bgGlow: 'bg-purple-500/20',
      available: false,
    },
  ]

  return (
    <div className="container py-8 space-y-8">
      {/* 헤더 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* 게임 목록 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => {
          const Icon = game.icon

          if (!game.available) {
            return (
              <Card
                key={game.id}
                className="relative overflow-hidden border-dashed opacity-60 cursor-not-allowed"
              >
                <div className={`absolute inset-0 ${game.bgGlow} blur-3xl`} />
                <CardHeader className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-br ${game.color}`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle>{t(`${game.id}.title`)}</CardTitle>
                    </div>
                    <Badge variant="secondary">{t('coming_soon')}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-muted-foreground">
                    {t(`${game.id}.description`)}
                  </p>
                </CardContent>
              </Card>
            )
          }

          return (
            <Link key={game.id} href={game.href}>
              <Card className="relative overflow-hidden group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
                <div
                  className={`absolute inset-0 ${game.bgGlow} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}
                />
                <CardHeader className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-br ${game.color} group-hover:scale-110 transition-transform`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {t(`${game.id}.title`)}
                      </CardTitle>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {t('play_now')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-muted-foreground">
                    {t(`${game.id}.description`)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* 안내 */}
      <p className="text-xs text-muted-foreground text-center opacity-50">{t('note')}</p>
    </div>
  )
}
