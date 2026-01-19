export const locales = ['ko', 'en', 'es', 'ja', 'de'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'ko'

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  es: 'Español',
  ja: '日本語',
  de: 'Deutsch',
}

export const localeFlags: Record<Locale, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  es: '🇪🇸',
  ja: '🇯🇵',
  de: '🇩🇪',
}
