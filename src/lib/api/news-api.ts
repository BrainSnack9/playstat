/**
 * 스포츠 뉴스 수집 API
 * RSS 피드에서 스포츠별 뉴스를 수집
 */

import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import type { SportId } from '@/lib/sport'

interface RSSSource {
  name: string
  url: string
  language: 'en' | 'ko'
}

// 스포츠별 RSS 피드 소스
const RSS_SOURCES: Record<SportId, RSSSource[]> = {
  football: [
    // 영어 소스
    { name: 'ESPN Football', url: 'https://www.espn.com/espn/rss/soccer/news', language: 'en' },
    { name: 'BBC Sport Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', language: 'en' },
    { name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040', language: 'en' },
    // 한국어 소스
    { name: '풋볼리스트', url: 'https://www.footballist.co.kr/rss/allArticle.xml', language: 'ko' },
    { name: '동아일보 스포츠', url: 'https://rss.donga.com/sports.xml', language: 'ko' },
    { name: '연합뉴스TV 스포츠', url: 'https://www.yonhapnewstv.co.kr/category/news/sports/feed/', language: 'ko' },
  ],
  basketball: [
    // 영어 소스
    { name: 'ESPN NBA', url: 'https://www.espn.com/espn/rss/nba/news', language: 'en' },
    { name: 'NBC Sports NBA', url: 'https://www.nbcsports.com/nba/rss', language: 'en' },
    // 한국어 소스
    { name: '스포츠조선 농구', url: 'https://sports.chosun.com/rss/rss_spo_nba.xml', language: 'ko' },
  ],
  baseball: [
    // 영어 소스
    { name: 'ESPN MLB', url: 'https://www.espn.com/espn/rss/mlb/news', language: 'en' },
    { name: 'MLB News', url: 'https://www.mlb.com/feeds/news/rss.xml', language: 'en' },
    // 한국어 소스
    { name: '스포츠조선 야구', url: 'https://sports.chosun.com/rss/rss_spo_mlb.xml', language: 'ko' },
  ],
}

// 기존 코드 호환성을 위한 축구 RSS 소스
const FOOTBALL_RSS_SOURCES = RSS_SOURCES.football

export interface NewsItem {
  title: string
  link: string
  description?: string
  pubDate: string
  source: string
  imageUrl?: string
}

export interface ProcessedNews {
  title: string
  titleKo: string
  link: string
  summary: string
  summaryKo: string
  source: string
  imageUrl?: string
  publishedAt: Date
  relatedTeams: string[]
}

/**
 * RSS 피드에서 뉴스 가져오기
 */
async function fetchRSSFeed(source: { name: string; url: string }): Promise<NewsItem[]> {
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'PlayStat News Aggregator',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(`Failed to fetch RSS from ${source.name}: ${response.status}`)
      return []
    }

    const xml = await response.text()
    return parseRSSFeed(xml, source.name)
  } catch (error) {
    console.error(`Error fetching RSS from ${source.name}:`, error)
    return []
  }
}

/**
 * RSS XML 파싱
 */
function parseRSSFeed(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = []

  // 간단한 XML 파싱 (정규식 사용)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]

    const title = extractXmlTag(itemXml, 'title')
    const link = extractXmlTag(itemXml, 'link')
    const description = extractXmlTag(itemXml, 'description')
    const pubDate = extractXmlTag(itemXml, 'pubDate')

    // 이미지 URL 추출 시도
    const mediaContent = itemXml.match(/url="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i)
    const enclosure = itemXml.match(/<enclosure[^>]+url="([^"]+)"/i)
    const imageUrl = mediaContent?.[1] || enclosure?.[1]

    if (title && link) {
      items.push({
        title: cleanHtml(title),
        link,
        description: description ? cleanHtml(description) : undefined,
        pubDate: pubDate || new Date().toISOString(),
        source: sourceName,
        imageUrl,
      })
    }
  }

  return items
}

/**
 * XML 태그 값 추출
 */
function extractXmlTag(xml: string, tagName: string): string | null {
  // CDATA 지원
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, 'i')
  const cdataMatch = xml.match(cdataRegex)
  if (cdataMatch) return cdataMatch[1].trim()

  // 일반 태그
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

/**
 * HTML 태그 제거
 */
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/**
 * AI로 뉴스 요약 및 번역
 */
async function processNewsWithAI(newsItem: NewsItem): Promise<ProcessedNews | null> {
  if (!openai) {
    console.warn('OpenAI not configured, skipping news processing')
    return null
  }

  try {
    const prompt = `다음 축구 뉴스를 분석해주세요:

제목: ${newsItem.title}
내용: ${newsItem.description || '(내용 없음)'}

다음 형식으로 응답해주세요 (JSON):
{
  "titleKo": "한국어 제목",
  "summaryKo": "한국어 요약 (2-3문장)",
  "summary": "영어 요약 (2-3 sentences)",
  "relatedTeams": ["관련된 팀명들 (영어)"]
}

중요:
- 베팅, 토토, 배당, 확률 관련 내용은 제외
- 순수하게 경기 관련 정보만 요약
- 팀명은 공식 영어명으로`

    const response = await openai.chat.completions.create({
      model: AI_MODELS.SUMMARY,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: TOKEN_LIMITS.SUMMARY,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)

    return {
      title: newsItem.title,
      titleKo: parsed.titleKo || newsItem.title,
      link: newsItem.link,
      summary: parsed.summary || newsItem.description || '',
      summaryKo: parsed.summaryKo || '',
      source: newsItem.source,
      imageUrl: newsItem.imageUrl,
      publishedAt: new Date(newsItem.pubDate),
      relatedTeams: parsed.relatedTeams || [],
    }
  } catch (error) {
    console.error('Error processing news with AI:', error)
    return null
  }
}

/**
 * 모든 소스에서 뉴스 수집
 */
export async function collectFootballNews(limit: number = 10): Promise<NewsItem[]> {
  const allNews: NewsItem[] = []

  for (const source of RSS_SOURCES) {
    const items = await fetchRSSFeed(source)
    allNews.push(...items)
  }

  // 날짜순 정렬 (최신순)
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // 중복 제거 (같은 제목)
  const uniqueNews = allNews.filter(
    (item, index, self) => index === self.findIndex((t) => t.title === item.title)
  )

  return uniqueNews.slice(0, limit)
}

/**
 * 뉴스 수집 및 AI 처리
 */
export async function collectAndProcessNews(limit: number = 10): Promise<ProcessedNews[]> {
  const rawNews = await collectFootballNews(limit * 2) // 처리 실패 대비 여유분
  const processedNews: ProcessedNews[] = []

  for (const item of rawNews) {
    if (processedNews.length >= limit) break

    const processed = await processNewsWithAI(item)
    if (processed) {
      processedNews.push(processed)
    }
  }

  return processedNews
}

/**
 * 주요 유럽 리그 관련 뉴스만 필터링
 */
const MAJOR_TEAMS = [
  // Premier League
  'Arsenal', 'Chelsea', 'Liverpool', 'Manchester United', 'Manchester City', 'Tottenham',
  // La Liga
  'Real Madrid', 'Barcelona', 'Atletico Madrid',
  // Serie A
  'Juventus', 'AC Milan', 'Inter Milan', 'Napoli',
  // Bundesliga
  'Bayern Munich', 'Borussia Dortmund',
  // Ligue 1
  'Paris Saint-Germain', 'PSG',
]

export function filterMajorLeagueNews(news: ProcessedNews[]): ProcessedNews[] {
  return news.filter((item) => {
    const titleLower = item.title.toLowerCase()
    const summaryLower = item.summary.toLowerCase()

    return MAJOR_TEAMS.some(
      (team) =>
        titleLower.includes(team.toLowerCase()) ||
        summaryLower.includes(team.toLowerCase()) ||
        item.relatedTeams.some((t) => t.toLowerCase().includes(team.toLowerCase()))
    )
  })
}

// 비축구 뉴스 필터링 키워드
const NON_FOOTBALL_KEYWORDS = [
  'NBA', 'MLB', 'KBO', '야구', '농구', '배구', '골프', '테니스',
  '배드민턴', 'F1', '격투기', 'UFC', '복싱', '올림픽', '아시안게임',
  '스키', '수영', '육상', '사이클', '탁구', '당구', 'e스포츠', 'LOL',
  '리그오브레전드', '발로란트', '오버워치', 'KBL', 'KOVO', 'PGA',
  'LPGA', 'ATP', 'WTA', '하키', '럭비', '크리켓', 'WBC', '바둑',
  '패럴림픽', '스노보드', '하프파이프', '크로스컨트리', 'Formula 1',
  'Racing Bulls', 'Red Bull Racing', 'livery', 'Tennis', 'Grand Slam',
  'Cricket', 'Test match', 'Duckett', 'wicket', 'Racing', 'horse racing',
  'jockey', 'MotoGP', 'NASCAR', 'IndyCar', 'darts', 'snooker', 'cycling'
]

// 축구 관련 키워드 (한국어 소스 필터링용)
const FOOTBALL_KEYWORDS = [
  '축구', '프리미어리그', 'EPL', '라리가', '분데스리가', '세리에A',
  '챔피언스리그', 'K리그', 'UEFA', 'FIFA', '월드컵', '손흥민',
  '맨체스터', '리버풀', '첼시', '아스날', '토트넘', '바르셀로나',
  '레알 마드리드', '바이에른', '유벤투스', '인터 밀란', 'AC밀란',
  'PSG', '파리 생제르맹', '홍명보', '이강인', '김민재', '황희찬'
]

/**
 * 축구 뉴스인지 확인
 */
function isFootballNews(news: NewsItem, sourceName: string): boolean {
  const text = `${news.title} ${news.description || ''}`.toLowerCase()

  // 비축구 키워드가 있으면 제외
  for (const keyword of NON_FOOTBALL_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return false
    }
  }

  // 축구 전용 소스면 바로 통과
  if (sourceName.includes('Football') || sourceName.includes('풋볼')) {
    return true
  }

  // 일반 스포츠 소스는 축구 키워드가 있어야 함
  for (const keyword of FOOTBALL_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return true
    }
  }

  return false
}

/**
 * 스포츠별 뉴스 수집 (RSS 기반)
 * 영어 + 한국어 RSS 피드에서 스포츠별 뉴스 수집
 */
export async function collectSportsNews(sport: SportId, limit: number = 15): Promise<NewsItem[]> {
  const allNews: NewsItem[] = []
  const sources = RSS_SOURCES[sport] || []

  // 각 소스별로 뉴스 수집
  for (const source of sources) {
    const items = await fetchRSSFeed(source)

    // 축구는 추가 필터링 적용 (일반 스포츠 피드에서 축구만 추출)
    if (sport === 'football') {
      const footballItems = items.filter(item => isFootballNews(item, source.name))
      allNews.push(...footballItems)
    } else {
      // 농구/야구는 전용 피드이므로 필터링 없이 사용
      allNews.push(...items)
    }
  }

  // 날짜순 정렬 (최신순)
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // 중복 제거 (같은 제목)
  const uniqueNews = allNews.filter(
    (item, index, self) => index === self.findIndex((t) => t.title === item.title)
  )

  return uniqueNews.slice(0, limit)
}

/**
 * 모든 소스에서 뉴스 통합 수집 (RSS 기반) - 기존 함수 호환성 유지
 * 영어 + 한국어 RSS 피드에서 축구 뉴스 수집
 */
export async function collectAllFootballNews(limit: number = 15): Promise<NewsItem[]> {
  return collectSportsNews('football', limit)
}
