import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legal' })

  return {
    title: t('privacy.title'),
    description: t('privacy.description'),
  }
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'legal' })

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="mb-8 text-3xl font-bold">{t('privacy.title')}</h1>

      <div className="prose prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          {t('privacy.last_updated')}: 2025-01-16
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.section1_title')}</h2>
          <p className="text-muted-foreground">{t('privacy.section1_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.section2_title')}</h2>
          <p className="text-muted-foreground mb-4">{t('privacy.section2_content')}</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>{t('privacy.data_type1')}</li>
            <li>{t('privacy.data_type2')}</li>
            <li>{t('privacy.data_type3')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.section3_title')}</h2>
          <p className="text-muted-foreground mb-4">{t('privacy.section3_content')}</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>{t('privacy.purpose1')}</li>
            <li>{t('privacy.purpose2')}</li>
            <li>{t('privacy.purpose3')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.section4_title')}</h2>
          <p className="text-muted-foreground">{t('privacy.section4_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.section5_title')}</h2>
          <p className="text-muted-foreground">{t('privacy.section5_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.section6_title')}</h2>
          <p className="text-muted-foreground">{t('privacy.section6_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('privacy.contact_title')}</h2>
          <p className="text-muted-foreground">{t('privacy.contact_content')}</p>
        </section>
      </div>
    </div>
  )
}
