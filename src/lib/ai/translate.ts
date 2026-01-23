import { prisma } from '@/lib/prisma'
import { Locale, locales } from '@/i18n/config'
import translate from 'google-translate-api-x'

// 언어 코드 매핑 (i18n locale -> Google Translate 언어 코드)
const LANG_MAP: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  es: 'es',
  ja: 'ja',
  de: 'de',
}

// 스포츠 팀 이름 목록 (번역하지 않고 원문 유지)

// NBA 팀 이름
const NBA_TEAM_NAMES = [
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
  'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
  'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
  'LA Clippers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'LA Lakers',
  'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves',
  'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic',
  'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings',
  'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
  // 짧은 이름
  'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Cavs',
  'Mavericks', 'Mavs', 'Nuggets', 'Pistons', 'Warriors', 'Dubs', 'Rockets',
  'Pacers', 'Clippers', 'Lakers', 'Grizzlies', 'Heat', 'Bucks', 'Timberwolves',
  'Wolves', 'Pelicans', 'Pels', 'Knicks', 'Thunder', 'Magic', '76ers', 'Sixers',
  'Suns', 'Trail Blazers', 'Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards'
]

// 축구 팀 이름 (Premier League, La Liga, Bundesliga, Serie A, Ligue 1)
const FOOTBALL_TEAM_NAMES = [
  // Premier League
  'Arsenal', 'Aston Villa', 'AFC Bournemouth', 'Bournemouth', 'Brentford',
  'Brighton & Hove Albion', 'Brighton', 'Chelsea', 'Crystal Palace',
  'Everton', 'Fulham', 'Ipswich Town', 'Ipswich', 'Leicester City', 'Leicester',
  'Liverpool', 'Manchester City', 'Man City', 'Manchester United', 'Man United', 'Man Utd',
  'Newcastle United', 'Newcastle', 'Nottingham Forest', "Nott'm Forest",
  'Southampton', 'Tottenham Hotspur', 'Tottenham', 'Spurs',
  'West Ham United', 'West Ham', 'Wolverhampton Wanderers', 'Wolves',
  // La Liga
  'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Atletico', 'Athletic Bilbao', 'Athletic Club',
  'Real Sociedad', 'Real Betis', 'Betis', 'Villarreal', 'Sevilla',
  'Valencia', 'Osasuna', 'Getafe', 'Celta Vigo', 'Celta', 'Mallorca',
  'Las Palmas', 'Rayo Vallecano', 'Alaves', 'Girona', 'Leganes', 'Valladolid', 'Espanyol',
  // Bundesliga
  'Bayern Munich', 'Bayern', 'Borussia Dortmund', 'Dortmund', 'BVB',
  'RB Leipzig', 'Leipzig', 'Bayer Leverkusen', 'Leverkusen',
  'Eintracht Frankfurt', 'Frankfurt', 'VfB Stuttgart', 'Stuttgart',
  'Borussia Monchengladbach', 'Monchengladbach', 'Gladbach',
  'Werder Bremen', 'Bremen', 'VfL Wolfsburg', 'Wolfsburg',
  'SC Freiburg', 'Freiburg', 'TSG Hoffenheim', 'Hoffenheim',
  'FC Augsburg', 'Augsburg', 'Mainz 05', 'Mainz',
  'Union Berlin', 'FC Koln', 'Koln', 'Heidenheim', 'Bochum', 'Darmstadt',
  // Serie A
  'Inter Milan', 'Inter', 'AC Milan', 'Milan', 'Juventus', 'Juve',
  'Napoli', 'Roma', 'AS Roma', 'Lazio', 'Atalanta', 'Fiorentina',
  'Bologna', 'Torino', 'Monza', 'Genoa', 'Lecce', 'Empoli',
  'Cagliari', 'Verona', 'Hellas Verona', 'Udinese', 'Sassuolo', 'Salernitana', 'Frosinone',
  // Ligue 1
  'Paris Saint-Germain', 'PSG', 'Marseille', 'Olympique Marseille', 'OM',
  'Monaco', 'AS Monaco', 'Lyon', 'Olympique Lyon', 'OL',
  'Lille', 'LOSC Lille', 'Nice', 'OGC Nice', 'Lens', 'RC Lens',
  'Rennes', 'Stade Rennais', 'Strasbourg', 'Nantes', 'Montpellier',
  'Reims', 'Toulouse', 'Brest', 'Le Havre', 'Metz', 'Lorient', 'Clermont'
]

// 모든 팀 이름 통합
const ALL_TEAM_NAMES = [...NBA_TEAM_NAMES, ...FOOTBALL_TEAM_NAMES]

// 스포츠 용어 번역 매핑 (Google Translate 오번역 방지)
const SPORTS_TERM_TRANSLATIONS: Record<string, Record<string, string>> = {
  'Fixtures': { ko: '경기', ja: '試合', de: 'Spiele', es: 'Partidos' },
  'Other Fixtures': { ko: '기타 경기', ja: 'その他の試合', de: 'Andere Spiele', es: 'Otros Partidos' },
}

/**
 * 팀 이름을 플레이스홀더로 대체하고 번역 후 복원합니다.
 */
function protectTeamNames(text: string): { protected: string; replacements: Map<string, string> } {
  const replacements = new Map<string, string>()
  let protected_text = text
  let index = 0

  // 긴 이름부터 처리 (Los Angeles Lakers가 Lakers보다 먼저 처리되도록)
  const sortedTeams = [...ALL_TEAM_NAMES].sort((a, b) => b.length - a.length)

  for (const teamName of sortedTeams) {
    // 대소문자 구분 없이 매칭, 단어 경계 고려
    const regex = new RegExp(`\\b${teamName}\\b`, 'gi')
    const matches = protected_text.match(regex)
    if (matches) {
      for (const match of matches) {
        const placeholder = `__TEAM_${index}__`
        replacements.set(placeholder, match)
        protected_text = protected_text.replace(match, placeholder)
        index++
      }
    }
  }

  return { protected: protected_text, replacements }
}

function restoreTeamNames(text: string, replacements: Map<string, string>): string {
  let restored = text
  for (const [placeholder, original] of replacements) {
    restored = restored.replace(placeholder, original)
  }
  return restored
}

/**
 * 스포츠 용어를 올바른 번역으로 교체합니다.
 */
function applySportsTermTranslations(text: string, targetLang: string): string {
  let result = text
  for (const [term, translations] of Object.entries(SPORTS_TERM_TRANSLATIONS)) {
    const correctTranslation = translations[targetLang]
    if (correctTranslation) {
      // 대소문자 구분 없이 매칭
      const regex = new RegExp(term, 'gi')
      result = result.replace(regex, correctTranslation)
    }
  }
  return result
}

/**
 * Google Translate (비공식 무료 API)를 사용하여 텍스트를 번역합니다.
 * 팀 이름은 원문 그대로 유지됩니다.
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!text || sourceLang === targetLang) return text
  if (text.trim().length === 0) return text

  const source = LANG_MAP[sourceLang] || sourceLang
  const target = LANG_MAP[targetLang] || targetLang

  // 스포츠 용어를 미리 올바른 번역으로 교체 (Google Translate 오번역 방지)
  const preProcessedText = applySportsTermTranslations(text, target)

  // 팀 이름 보호
  const { protected: protectedText, replacements } = protectTeamNames(preProcessedText)

  try {
    const result = await translate(protectedText, {
      from: source,
      to: target,
      autoCorrect: false,
    })

    // 팀 이름 복원
    const translatedText = result.text || text
    return restoreTeamNames(translatedText, replacements)
  } catch (error) {
    console.error(`[Translate] Google Translate failed:`, error)
    return text
  }
}

/**
 * 텍스트를 특정 언어로 번역합니다.
 */
export async function translateText(
  text: string,
  targetLang: Locale,
  _context?: string // 하위 호환성을 위해 유지 (사용 안 함)
): Promise<string> {
  if (!text || targetLang === 'en') return text
  return translateWithGoogle(text, 'en', targetLang)
}

/**
 * 여러 언어로 한꺼번에 번역하여 객체로 반환합니다.
 */
export async function translateToAllLocales(
  text: string,
  _context?: string,
  exclude: Locale[] = ['en']
): Promise<Record<string, string>> {
  const targetLocales = locales.filter(l => !exclude.includes(l as Locale))

  const translations: Record<string, string> = {}

  // 순차 번역 (Rate limit 방지)
  for (const lang of targetLocales) {
    translations[lang] = await translateText(text, lang as Locale)
    // Rate limit 방지를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return translations
}

/**
 * 경기 분석 데이터의 누락된 번역본을 채웁니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureMatchAnalysisTranslations(analysis: any) {
  if (!analysis) return analysis

  // 영문 데이터(원본)가 있는지 확인 (translations.en에서만 가져옴)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const englishData = (analysis.translations as any)?.en

  // 영문 데이터가 없으면 번역 불가
  if (!englishData?.summary) {
    console.warn('[Translate] No English data available for analysis')
    return analysis
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentTranslations = (analysis.translations as any) || {}
  let hasChanges = false
  const updatedTranslations = { ...currentTranslations, en: englishData }

  // 모든 언어에 대해 번역이 있는지 확인
  for (const lang of locales) {
    if (lang === 'en') continue

    if (!currentTranslations[lang]) {
      hasChanges = true
      console.log(`[Translate] Translating analysis to ${lang} using Google Translate...`)

      try {
        // 각 필드를 순차적으로 번역 (Rate limit 방지)
        const summary = await translateText(englishData.summary, lang as Locale)
        await new Promise(resolve => setTimeout(resolve, 500))

        const tactical = englishData.tacticalAnalysis
          ? await translateText(englishData.tacticalAnalysis, lang as Locale)
          : null
        await new Promise(resolve => setTimeout(resolve, 500))

        const flow = englishData.recentFlowAnalysis
          ? await translateText(englishData.recentFlowAnalysis, lang as Locale)
          : null
        await new Promise(resolve => setTimeout(resolve, 500))

        const trends = englishData.seasonTrends
          ? await translateText(englishData.seasonTrends, lang as Locale)
          : null

        // keyPoints 배열 번역
        let keyPoints = englishData.keyPoints
        if (Array.isArray(englishData.keyPoints) && englishData.keyPoints.length > 0) {
          keyPoints = []
          for (const point of englishData.keyPoints) {
            await new Promise(resolve => setTimeout(resolve, 500))
            const translatedPoint = await translateText(point, lang as Locale)
            keyPoints.push(translatedPoint)
          }
        }

        updatedTranslations[lang] = {
          summary,
          tacticalAnalysis: tactical,
          recentFlowAnalysis: flow,
          seasonTrends: trends,
          keyPoints
        }
      } catch (error) {
        console.error(`[Translate] Failed to translate analysis to ${lang}:`, error)
      }
    }
  }

  if (hasChanges) {
    await prisma.matchAnalysis.update({
      where: { id: analysis.id },
      data: { translations: updatedTranslations },
    })
    return { ...analysis, translations: updatedTranslations }
  }

  return analysis
}

/**
 * 데일리 리포트의 누락된 번역본을 채웁니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureDailyReportTranslations(report: any) {
  if (!report) return report

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentTranslations = (report.translations as any) || {}

  // 영문 데이터 추출 (translations.en에서만 가져옴)
  const englishData = currentTranslations.en
  if (!englishData) {
    console.warn('[Translate] No English data available for daily report')
    return report
  }

  let hasChanges = false
  const updatedTranslations = { ...currentTranslations }

  for (const lang of locales) {
    if (lang === 'en') continue

    if (!currentTranslations[lang]) {
      hasChanges = true
      console.log(`[Translate] Translating daily report to ${lang} using Google Translate...`)

      try {
        // JSON 객체의 각 문자열 필드를 번역
        const translatedData = await translateJsonObject(englishData, lang as Locale)
        updatedTranslations[lang] = translatedData
      } catch (e) {
        console.error(`[Translate] Daily report translation to ${lang} failed:`, e)
      }
    }
  }

  if (hasChanges) {
    await prisma.dailyReport.update({
      where: { id: report.id },
      data: { translations: updatedTranslations },
    })
    return { ...report, translations: updatedTranslations }
  }

  return report
}

/**
 * JSON 객체 내의 모든 문자열을 번역합니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function translateJsonObject(obj: any, targetLang: Locale): Promise<any> {
  if (!obj) return obj

  if (typeof obj === 'string') {
    return translateText(obj, targetLang)
  }

  if (Array.isArray(obj)) {
    const result = []
    for (const item of obj) {
      await new Promise(resolve => setTimeout(resolve, 300))
      result.push(await translateJsonObject(item, targetLang))
    }
    return result
  }

  if (typeof obj === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      await new Promise(resolve => setTimeout(resolve, 300))
      result[key] = await translateJsonObject(value, targetLang)
    }
    return result
  }

  return obj
}
