import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Mail, Clock, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contact' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'contact' })

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="mb-4 text-3xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-muted-foreground">{t('description')}</p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              {t('email_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href="mailto:contact@playstat.space"
              className="text-primary hover:underline"
            >
              contact@playstat.space
            </a>
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              {t('response_time_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('response_time_desc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Inquiry Types */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t('inquiry_types_title')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-semibold">{t('inquiry_general')}</h3>
              <p className="text-sm text-muted-foreground">{t('inquiry_general_desc')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-semibold">{t('inquiry_ads')}</h3>
              <p className="text-sm text-muted-foreground">{t('inquiry_ads_desc')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-semibold">{t('inquiry_content')}</h3>
              <p className="text-sm text-muted-foreground">{t('inquiry_content_desc')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
