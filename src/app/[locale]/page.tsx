import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TodayMatches } from '@/components/matches/today-matches'
import { LatestNews } from '@/components/news/latest-news'
import { ArrowRight, Trophy, Calendar, Newspaper, ChartBar } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  const seo = await getTranslations({ locale, namespace: 'seo' })

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: seo('site_name'),
    },
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="container py-8">
      {/* Hero Section */}
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          <span className="gradient-text">PlayStat</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
          AI 기반 스포츠 분석 플랫폼. 축구, NBA, MLB 경기를 더 깊이 이해하세요.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/matches/today">
              <Calendar className="mr-2 h-5 w-5" />
              오늘의 경기
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/daily-report">
              <ChartBar className="mr-2 h-5 w-5" />
              데일리 리포트
            </Link>
          </Button>
        </div>
      </section>

      <Separator className="mb-12" />

      {/* Featured Leagues */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">주요 리그</h2>
          <Button asChild variant="ghost">
            <Link href="/leagues">
              전체 보기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {[
            { name: 'Premier League', slug: 'epl', country: 'England' },
            { name: 'La Liga', slug: 'laliga', country: 'Spain' },
            { name: 'Serie A', slug: 'serie-a', country: 'Italy' },
            { name: 'Bundesliga', slug: 'bundesliga', country: 'Germany' },
            { name: 'Champions League', slug: 'ucl', country: 'Europe' },
            { name: 'K League 1', slug: 'k-league', country: 'Korea' },
          ].map((league) => (
            <Link key={league.slug} href={`/league/${league.slug}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-center p-4 text-center">
                  <Trophy className="mb-2 h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-sm">{league.name}</h3>
                  <p className="text-xs text-muted-foreground">{league.country}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's Matches */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">오늘의 경기</h2>
          <Button asChild variant="ghost">
            <Link href="/matches/today">
              전체 보기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <TodayMatches />
      </section>

      {/* Latest News */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">최신 뉴스</h2>
          <Button asChild variant="ghost">
            <Link href="/news">
              전체 보기 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <LatestNews />
      </section>

      {/* Features */}
      <section>
        <h2 className="section-title mb-6 text-center">PlayStat의 특징</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ChartBar className="mr-2 h-5 w-5 text-primary" />
                AI 경기 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                최신 AI 기술로 경기를 심층 분석합니다. 전술, 선수 역할, 팀 트렌드를 한눈에 파악하세요.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Newspaper className="mr-2 h-5 w-5 text-primary" />
                실시간 뉴스 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                전 세계 스포츠 뉴스를 AI가 핵심만 요약해 드립니다. 바쁜 일상 속에서도 스포츠 소식을 놓치지 마세요.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="mr-2 h-5 w-5 text-primary" />
                멀티 스포츠 지원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                축구는 물론 NBA, MLB까지. 다양한 스포츠의 분석과 인사이트를 한 곳에서 만나보세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
