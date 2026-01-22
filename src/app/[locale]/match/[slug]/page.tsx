import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

// 기존 /match/[slug] 경로를 /[sport]/match/[slug]로 리다이렉트
export default async function MatchRedirectPage({ params }: Props) {
  const { locale, slug } = await params

  // 경기 정보에서 sportType 확인
  const match = await prisma.match.findUnique({
    where: { slug },
    select: { sportType: true },
  })

  if (!match) {
    redirect(`/${locale}/football/matches`)
  }

  // sportType을 URL 경로로 변환
  const sportMap: Record<string, string> = {
    FOOTBALL: 'football',
    BASKETBALL: 'basketball',
    BASEBALL: 'baseball',
  }

  const sport = sportMap[match.sportType] || 'football'

  redirect(`/${locale}/${sport}/match/${slug}`)
}
