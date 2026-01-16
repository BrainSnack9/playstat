import { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legal' })

  return {
    title: t('terms.title'),
    description: t('terms.description'),
  }
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'legal' })

  return (
    <div className="container max-w-4xl py-12">
      <h1 className="mb-8 text-3xl font-bold">{t('terms.title')}</h1>

      <div className="prose prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          {t('terms.last_updated')}: 2025-01-16
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section1_title')}</h2>
          <p className="text-muted-foreground">{t('terms.section1_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section2_title')}</h2>
          <p className="text-muted-foreground">{t('terms.section2_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section3_title')}</h2>
          <p className="text-muted-foreground mb-4">{t('terms.section3_content')}</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>{t('terms.prohibited1')}</li>
            <li>{t('terms.prohibited2')}</li>
            <li>{t('terms.prohibited3')}</li>
            <li>{t('terms.prohibited4')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section4_title')}</h2>
          <p className="text-muted-foreground">{t('terms.section4_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section5_title')}</h2>
          <p className="text-muted-foreground">{t('terms.section5_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section6_title')}</h2>
          <p className="text-muted-foreground">{t('terms.section6_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.section7_title')}</h2>
          <p className="text-muted-foreground">{t('terms.section7_content')}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('terms.contact_title')}</h2>
          <p className="text-muted-foreground">{t('terms.contact_content')}</p>
        </section>
      </div>
    </div>
  )
}
