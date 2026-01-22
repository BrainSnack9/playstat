import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ locale: string; date: string }>
}

// 기존 /daily/[date] 경로를 /football/daily/[date]로 리다이렉트
export default async function DailyRedirectPage({ params }: Props) {
  const { locale, date } = await params
  redirect(`/${locale}/football/daily/${date}`)
}
