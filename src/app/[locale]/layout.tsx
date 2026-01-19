import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { locales, type Locale } from '@/i18n/config'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { TimezoneDetector } from '@/components/timezone-detector'
import { AdsenseScript } from '@/components/adsense'
import { Analytics } from '@vercel/analytics/next'
import { getSportFromCookie, isApexHost, SPORT_COOKIE } from '@/lib/sport'
import { spaceGrotesk } from '@/lib/fonts'
import '../globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    template: '%s | PlayStat',
    default: 'PlayStat - AI Sports Analysis Platform',
  },
  description: 'AI-powered sports analysis platform for Football, NBA, and MLB',
  keywords: ['sports', 'analysis', 'football', 'NBA', 'MLB', 'AI', 'soccer', 'EPL', 'K-League'],
  authors: [{ name: 'PlayStat' }],
  creator: 'PlayStat',
  openGraph: {
    type: 'website',
    siteName: 'PlayStat',
    locale: 'ko_KR',
    alternateLocale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@playstat',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

interface RootLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params

  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()
  const direction = locale === 'ar' ? 'rtl' : 'ltr'
  const sport = getSportFromCookie(cookies().get(SPORT_COOKIE)?.value)
  const host = headers().get('host')
  const isApex = isApexHost(host)
  // 모든 스포츠 서브도메인에 네온 테마 적용 (CSS 변수로 스포츠별 색상 구분)
  const isNeon = !isApex

  return (
    <html lang={locale} dir={direction} className="dark" data-sport={sport} suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="8jWKeSdNb8M9T-sx7Tn_F5aEyGUSCpmWHl-h3xYdq6U" />
        <AdsenseScript />
      </head>
      <body className={`${inter.className} ${isNeon ? spaceGrotesk.className : ''} bg-background text-foreground`}>
        <NextIntlClientProvider messages={messages}>
          <TimezoneDetector />
          <div className="flex min-h-screen flex-col">
            {!isApex && <Header variant={isNeon ? 'neon' : 'default'} />}
            <main className="flex-1">{children}</main>
            <Footer variant={isApex ? 'landing' : isNeon ? 'neon' : 'default'} />
          </div>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
