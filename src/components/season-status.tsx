import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Snowflake, Sun, Trophy } from 'lucide-react'
import { getSeasonInfo, type SportId } from '@/lib/sport'
import { getTranslations } from 'next-intl/server'
import { format, formatDistanceToNow } from 'date-fns'
import { ko, enUS } from 'date-fns/locale'

interface SeasonStatusProps {
  sport: SportId
  locale?: string
}

export async function SeasonStatus({ sport, locale = 'ko' }: SeasonStatusProps) {
  const t = await getTranslations({ locale, namespace: 'season' })
  const seasonInfo = getSeasonInfo(sport)
  const dateLocale = locale === 'ko' ? ko : enUS

  // 시즌 중이면 표시하지 않음
  if (!seasonInfo.isOffseason) {
    return null
  }

  const sportEmoji = sport === 'football' ? '⚽' : sport === 'basketball' ? '🏀' : '⚾'
  const sportName = sport === 'football' ? t('football') : sport === 'basketball' ? t('basketball') : t('baseball')

  // 다음 시즌 시작일까지 남은 시간
  const timeUntilStart = seasonInfo.nextSeasonStart
    ? formatDistanceToNow(seasonInfo.nextSeasonStart, { addSuffix: true, locale: dateLocale })
    : null

  const nextSeasonDateStr = seasonInfo.nextSeasonStart
    ? format(seasonInfo.nextSeasonStart, locale === 'ko' ? 'yyyy년 M월' : 'MMMM yyyy', { locale: dateLocale })
    : null

  return (
    <Card className="border-muted-foreground/20 bg-gradient-to-br from-muted/50 to-muted/30">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
            <Snowflake className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                {sportEmoji} {sportName} {t('offseason')}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {t('offseason_badge')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('offseason_message', { sport: sportName })}
            </p>
            {seasonInfo.nextSeasonStart && (
              <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
                <div className="flex items-center gap-1.5 text-primary">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {t('next_season_start')}: {nextSeasonDateStr}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{timeUntilStart}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 시즌 상태를 간단히 표시하는 배지 컴포넌트
interface SeasonBadgeProps {
  sport: SportId
  locale?: string
}

export async function SeasonBadge({ sport, locale = 'ko' }: SeasonBadgeProps) {
  const t = await getTranslations({ locale, namespace: 'season' })
  const seasonInfo = getSeasonInfo(sport)

  const phaseConfig = {
    preseason: { icon: Sun, label: t('preseason'), variant: 'outline' as const },
    regular: { icon: Trophy, label: t('regular_season'), variant: 'default' as const },
    postseason: { icon: Trophy, label: t('postseason'), variant: 'default' as const },
    offseason: { icon: Snowflake, label: t('offseason_badge'), variant: 'secondary' as const },
  }

  const config = phaseConfig[seasonInfo.currentPhase]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}
