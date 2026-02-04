import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FileQuestion, Home, ChartBar } from 'lucide-react'
import { getTranslations, getLocale } from 'next-intl/server'

export default async function NotFound() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'error_page' })
  const todayDate = new Date().toISOString().slice(0, 10)

  return (
    <div className="container flex min-h-[50vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">{t('not_found_title')}</h2>
          <p className="mb-6 text-muted-foreground">
            {t('not_found_description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button asChild className="flex-1">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                {t('go_home')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/football/daily/${todayDate}`}>
                <ChartBar className="mr-2 h-4 w-4" />
                {t('view_today_report')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
