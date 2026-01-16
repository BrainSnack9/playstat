import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartBar, Shield, Users, Zap } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'about' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'about' })

  const features = [
    {
      icon: ChartBar,
      title: t('feature1_title'),
      description: t('feature1_description'),
    },
    {
      icon: Zap,
      title: t('feature2_title'),
      description: t('feature2_description'),
    },
    {
      icon: Shield,
      title: t('feature3_title'),
      description: t('feature3_description'),
    },
    {
      icon: Users,
      title: t('feature4_title'),
      description: t('feature4_description'),
    },
  ]

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="mb-4 text-3xl font-bold">{t('title')}</h1>
      <p className="mb-12 text-lg text-muted-foreground">{t('description')}</p>

      {/* Mission Section */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold">{t('mission_title')}</h2>
        <p className="text-muted-foreground leading-relaxed">{t('mission_content')}</p>
      </section>

      {/* Features Section */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold">{t('features_title')}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <feature.icon className="mb-2 h-8 w-8 text-primary" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold">{t('offer_title')}</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start">
            <span className="mr-2 text-primary">•</span>
            {t('offer1')}
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-primary">•</span>
            {t('offer2')}
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-primary">•</span>
            {t('offer3')}
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-primary">•</span>
            {t('offer4')}
          </li>
        </ul>
      </section>

      {/* Disclaimer Section */}
      <section className="rounded-lg border border-muted p-6">
        <h2 className="mb-4 text-xl font-semibold">{t('disclaimer_title')}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('disclaimer_content')}
        </p>
      </section>
    </div>
  )
}
