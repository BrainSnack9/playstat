import { PrismaClient } from '@prisma/client'
import translate from 'google-translate-api-x'

const prisma = new PrismaClient()

const locales = ['ko', 'ja', 'de', 'es']

const LANG_MAP: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  es: 'es',
  ja: 'ja',
  de: 'de',
}

async function translateJsonObject(obj: any, targetLang: string): Promise<any> {
  if (typeof obj === 'string' && obj.trim()) {
    try {
      const result = await translate(obj, { to: LANG_MAP[targetLang] || targetLang })
      return result.text
    } catch (e) {
      console.error('Translation error:', e)
      return obj
    }
  }

  if (Array.isArray(obj)) {
    const results = []
    for (const item of obj) {
      results.push(await translateJsonObject(item, targetLang))
    }
    return results
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await translateJsonObject(value, targetLang)
    }
    return result
  }

  return obj
}

async function main() {
  const dateArg = process.argv[2] || '2026-01-25'

  const report = await prisma.dailyReport.findFirst({
    where: {
      date: new Date(dateArg),
      sportType: 'FOOTBALL'
    }
  })

  if (!report) {
    console.log('Report not found for date:', dateArg)
    return
  }

  const translations = (report.translations as any) || {}
  const englishData = translations.en

  if (!englishData) {
    console.log('No English data to translate from')
    return
  }

  console.log('Found report for', dateArg)
  console.log('Current locales:', Object.keys(translations))

  for (const lang of locales) {
    if (!translations[lang]) {
      console.log(`Translating to ${lang}...`)
      try {
        translations[lang] = await translateJsonObject(englishData, lang)
        console.log(`Done: ${lang}`)
      } catch (e) {
        console.error(`Failed ${lang}:`, e)
      }
    } else {
      console.log(`Skipping ${lang} (already exists)`)
    }
  }

  await prisma.dailyReport.update({
    where: { id: report.id },
    data: { translations }
  })

  console.log('Updated! Final locales:', Object.keys(translations))
}

main().catch(console.error).finally(() => prisma.$disconnect())
