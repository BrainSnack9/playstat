import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { locales, type Locale } from '@/i18n/config'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { TimezoneDetector } from '@/components/timezone-detector'
import { SportThemeSetter } from '@/components/sport-theme-setter'
import { AdsenseScript } from '@/components/adsense'
import { Analytics } from '@vercel/analytics/next'
import { generateOrganizationJsonLd, generateWebsiteJsonLd, resolveBaseUrl } from '@/lib/seo'
import '../globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    template: '%s | PlayStat',
    default: 'PlayStat - AI Sports Analysis Platform',
  },
  description: 'AI-powered sports analysis platform for Football, NBA, and MLB',
  keywords: [
    'sports', 'analysis', 'AI', 'soccer', 'football',
    // Football Leagues
    'Premier League', 'EPL', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
    'Champions League', 'UEFA', 'Eredivisie', 'Championship',
    // Basketball
    'NBA', 'basketball',
    // Baseball
    'MLB', 'baseball',
    // Korean terms
    '축구', '농구', '야구', '스포츠 분석', '경기 분석',
  ],
  authors: [{ name: 'PlayStat' }],
  creator: 'PlayStat',
  publisher: 'PlayStat',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://playstat.space'),
  openGraph: {
    type: 'website',
    siteName: 'PlayStat',
    locale: 'ko_KR',
    alternateLocale: ['en_US', 'ja_JP', 'es_ES', 'de_DE'],
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PlayStat - AI Sports Analysis Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@playstat',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/app-icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/app-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PlayStat',
  },
  formatDetection: {
    telephone: false,
  },
  category: 'sports',
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
  const host = headers().get('host')
  const baseUrl = resolveBaseUrl(host)

  return (
    <html lang={locale} dir={direction} className="dark" data-sport="football" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="8jWKeSdNb8M9T-sx7Tn_F5aEyGUSCpmWHl-h3xYdq6U" />
        <meta name="theme-color" content="#10b981" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <link rel="canonical" href={`${baseUrl}/${locale}`} />
        <AdsenseScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              generateOrganizationJsonLd(baseUrl),
              generateWebsiteJsonLd(locale as Locale, baseUrl),
            ]),
          }}
        />
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        <SportThemeSetter />
        <NextIntlClientProvider messages={messages}>
          <TimezoneDetector />
          <div className="flex min-h-screen flex-col">
            <Header variant="default" />
            <main className="flex-1">{children}</main>
            <Footer variant="default" />
          </div>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
