import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

// Football Slug to competition code mapping
const FOOTBALL_SLUG_TO_CODE: Record<string, string> = {
  pl: 'PL', pd: 'PD', sa: 'SA', bl1: 'BL1', fl1: 'FL1', cl: 'CL', ded: 'DED', ppl: 'PPL',
  epl: 'PL', laliga: 'PD', 'serie-a': 'SA', bundesliga: 'BL1', ligue1: 'FL1', ucl: 'CL',
  eredivisie: 'DED', 'primeira-liga': 'PPL',
}

// Basketball Slug to code mapping
const BASKETBALL_SLUG_TO_CODE: Record<string, string> = {
  nba: 'NBA',
}

// Baseball Slug to code mapping
const BASEBALL_SLUG_TO_CODE: Record<string, string> = {
  mlb: 'MLB',
}

// 기존 /league/[slug] 경로를 /[sport]/league/[slug]로 리다이렉트
export default async function LeagueRedirectPage({ params }: Props) {
  const { locale, slug } = await params

  // 먼저 slug로 스포츠 타입 추론
  let sport = 'football'

  if (BASKETBALL_SLUG_TO_CODE[slug]) {
    sport = 'basketball'
  } else if (BASEBALL_SLUG_TO_CODE[slug]) {
    sport = 'baseball'
  } else if (FOOTBALL_SLUG_TO_CODE[slug]) {
    sport = 'football'
  } else {
    // slug로 추론 불가시 DB에서 확인
    const code = slug.toUpperCase()
    const league = await prisma.league.findFirst({
      where: { code },
      select: { sportType: true },
    })

    if (league) {
      const sportMap: Record<string, string> = {
        FOOTBALL: 'football',
        BASKETBALL: 'basketball',
        BASEBALL: 'baseball',
      }
      sport = sportMap[league.sportType] || 'football'
    }
  }

  redirect(`/${locale}/${sport}/league/${slug}`)
}
