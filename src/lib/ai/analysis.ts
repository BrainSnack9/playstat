import { openai, AI_MODELS, TOKEN_LIMITS } from '@/lib/openai'
import {
  MATCH_ANALYSIS_PROMPT,
  MATCH_ANALYSIS_PROMPT_EN,
  NEWS_SUMMARY_PROMPT,
  NEWS_SUMMARY_PROMPT_EN,
  TEAM_ANALYSIS_PROMPT,
  TEAM_ANALYSIS_PROMPT_EN,
  DAILY_REPORT_PROMPT,
  DAILY_REPORT_PROMPT_EN,
  fillPrompt,
} from './prompts'

export interface MatchAnalysisInput {
  homeTeam: {
    name: string
    recentForm: string // e.g., "WWDLW"
    recentMatches: string[] // 최근 경기 결과 설명
    stats: {
      goalsFor: number
      goalsAgainst: number
      cleanSheets: number
    }
  }
  awayTeam: {
    name: string
    recentForm: string
    recentMatches: string[]
    stats: {
      goalsFor: number
      goalsAgainst: number
      cleanSheets: number
    }
  }
  headToHead?: string[] // 상대 전적
  injuries?: {
    home: string[]
    away: string[]
  }
  venue?: string
  competition?: string
  additionalContext?: string
}

export interface MatchAnalysisOutput {
  summary: string
  summaryEn?: string
  tactics: string
  tacticsEn?: string
  keyPoints: string[]
  riskFactors: string[]
  positiveFactors: string[]
  expectedFlow: string
  expectedFlowEn?: string
}

export interface NewsSummaryOutput {
  summary: string
  summaryEn?: string
  relatedTeams: string[]
  relatedPlayers: string[]
}

export interface TeamAnalysisOutput {
  analysis: string
  analysisEn?: string
  tactics: string
  tacticsEn?: string
  strengths: string[]
  weaknesses: string[]
}

export interface DailyReportOutput {
  summary: string
  summaryEn?: string
  hotMatches: Array<{
    title: string
    description: string
  }>
  keyNews: Array<{
    title: string
    summary: string
  }>
  insights: string[]
}

function formatMatchDataForPrompt(input: MatchAnalysisInput): string {
  const parts: string[] = []

  parts.push(`경기: ${input.homeTeam.name} vs ${input.awayTeam.name}`)
  if (input.competition) parts.push(`대회: ${input.competition}`)
  if (input.venue) parts.push(`경기장: ${input.venue}`)

  parts.push(`\n[${input.homeTeam.name} 정보]`)
  parts.push(`- 최근 폼: ${input.homeTeam.recentForm}`)
  parts.push(`- 최근 경기: ${input.homeTeam.recentMatches.join(', ')}`)
  parts.push(
    `- 시즌 스탯: 득점 ${input.homeTeam.stats.goalsFor}, 실점 ${input.homeTeam.stats.goalsAgainst}, 클린시트 ${input.homeTeam.stats.cleanSheets}`
  )
  if (input.injuries?.home?.length) {
    parts.push(`- 부상/결장: ${input.injuries.home.join(', ')}`)
  }

  parts.push(`\n[${input.awayTeam.name} 정보]`)
  parts.push(`- 최근 폼: ${input.awayTeam.recentForm}`)
  parts.push(`- 최근 경기: ${input.awayTeam.recentMatches.join(', ')}`)
  parts.push(
    `- 시즌 스탯: 득점 ${input.awayTeam.stats.goalsFor}, 실점 ${input.awayTeam.stats.goalsAgainst}, 클린시트 ${input.awayTeam.stats.cleanSheets}`
  )
  if (input.injuries?.away?.length) {
    parts.push(`- 부상/결장: ${input.injuries.away.join(', ')}`)
  }

  if (input.headToHead?.length) {
    parts.push(`\n[상대 전적]`)
    parts.push(input.headToHead.join('\n'))
  }

  if (input.additionalContext) {
    parts.push(`\n[추가 정보]`)
    parts.push(input.additionalContext)
  }

  return parts.join('\n')
}

// 경기 분석 생성
export async function generateMatchAnalysis(
  input: MatchAnalysisInput,
  includeEnglish: boolean = true
): Promise<MatchAnalysisOutput | null> {
  if (!openai) {
    console.error('OpenAI client not initialized')
    return null
  }

  const matchData = formatMatchDataForPrompt(input)

  try {
    // 한국어 분석 생성
    const koreanPrompt = fillPrompt(MATCH_ANALYSIS_PROMPT, { matchData })
    const koreanResponse = await openai.chat.completions.create({
      model: AI_MODELS.ANALYSIS,
      messages: [{ role: 'user', content: koreanPrompt }],
      max_tokens: TOKEN_LIMITS.ANALYSIS,
      temperature: 0.7,
    })

    const koreanContent = koreanResponse.choices[0]?.message?.content
    if (!koreanContent) {
      throw new Error('No response from OpenAI')
    }

    // 파싱
    const result = parseMatchAnalysis(koreanContent)

    // 영어 버전 생성 (옵션)
    if (includeEnglish) {
      const englishPrompt = fillPrompt(MATCH_ANALYSIS_PROMPT_EN, { matchData })
      const englishResponse = await openai.chat.completions.create({
        model: AI_MODELS.SUMMARY, // 비용 절감을 위해 mini 모델 사용
        messages: [{ role: 'user', content: englishPrompt }],
        max_tokens: TOKEN_LIMITS.ANALYSIS,
        temperature: 0.7,
      })

      const englishContent = englishResponse.choices[0]?.message?.content
      if (englishContent) {
        const englishResult = parseMatchAnalysis(englishContent)
        result.summaryEn = englishResult.summary
        result.tacticsEn = englishResult.tactics
        result.expectedFlowEn = englishResult.expectedFlow
      }
    }

    return result
  } catch (error) {
    console.error('Error generating match analysis:', error)
    return null
  }
}

function parseMatchAnalysis(content: string): MatchAnalysisOutput {
  const sections = content.split('##').map((s) => s.trim()).filter(Boolean)

  const result: MatchAnalysisOutput = {
    summary: '',
    tactics: '',
    keyPoints: [],
    riskFactors: [],
    positiveFactors: [],
    expectedFlow: '',
  }

  for (const section of sections) {
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
    const title = lines[0]?.toLowerCase() || ''

    if (title.includes('요약') || title.includes('summary')) {
      result.summary = lines
        .slice(1)
        .filter((l) => l.startsWith('-'))
        .map((l) => l.replace(/^-\s*/, ''))
        .join('\n')
    } else if (title.includes('전술') || title.includes('tactical')) {
      result.tactics = lines.slice(1).join('\n')
    } else if (title.includes('핵심 포인트') || title.includes('key')) {
      result.keyPoints = lines
        .slice(1)
        .filter((l) => /^\d+\./.test(l))
        .map((l) => l.replace(/^\d+\.\s*/, ''))
    } else if (title.includes('위험') || title.includes('risk')) {
      result.riskFactors = lines
        .slice(1)
        .filter((l) => /^\d+\./.test(l))
        .map((l) => l.replace(/^\d+\.\s*/, ''))
    } else if (title.includes('긍정') || title.includes('positive')) {
      result.positiveFactors = lines
        .slice(1)
        .filter((l) => /^\d+\./.test(l))
        .map((l) => l.replace(/^\d+\.\s*/, ''))
    } else if (title.includes('흐름') || title.includes('flow')) {
      result.expectedFlow = lines.slice(1).join('\n')
    }
  }

  return result
}

// 뉴스 요약 생성
export async function generateNewsSummary(
  article: string,
  includeEnglish: boolean = true
): Promise<NewsSummaryOutput | null> {
  if (!openai) {
    console.error('OpenAI client not initialized')
    return null
  }

  try {
    const koreanPrompt = fillPrompt(NEWS_SUMMARY_PROMPT, { article })
    const response = await openai.chat.completions.create({
      model: AI_MODELS.SUMMARY,
      messages: [{ role: 'user', content: koreanPrompt }],
      max_tokens: TOKEN_LIMITS.SUMMARY,
      temperature: 0.5,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const result = parseNewsSummary(content)

    if (includeEnglish) {
      const englishPrompt = fillPrompt(NEWS_SUMMARY_PROMPT_EN, { article })
      const englishResponse = await openai.chat.completions.create({
        model: AI_MODELS.SUMMARY,
        messages: [{ role: 'user', content: englishPrompt }],
        max_tokens: TOKEN_LIMITS.SUMMARY,
        temperature: 0.5,
      })

      const englishContent = englishResponse.choices[0]?.message?.content
      if (englishContent) {
        const englishResult = parseNewsSummary(englishContent)
        result.summaryEn = englishResult.summary
      }
    }

    return result
  } catch (error) {
    console.error('Error generating news summary:', error)
    return null
  }
}

function parseNewsSummary(content: string): NewsSummaryOutput {
  const result: NewsSummaryOutput = {
    summary: '',
    relatedTeams: [],
    relatedPlayers: [],
  }

  const parts = content.split('**').filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].toLowerCase()
    const nextPart = parts[i + 1] || ''

    if (part.includes('요약') || part.includes('summary')) {
      result.summary = nextPart
        .split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.replace(/^-\s*/, '').trim())
        .join('\n')
    } else if (part.includes('팀') || part.includes('선수') || part.includes('team') || part.includes('player')) {
      const items = nextPart
        .split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.replace(/^-\s*/, '').trim())

      // 간단한 휴리스틱으로 팀/선수 구분
      items.forEach((item) => {
        if (item.includes('FC') || item.includes('United') || item.includes('City')) {
          result.relatedTeams.push(item)
        } else {
          result.relatedPlayers.push(item)
        }
      })
    }
  }

  return result
}

// 팀 분석 생성
export async function generateTeamAnalysis(
  teamData: string,
  includeEnglish: boolean = true
): Promise<TeamAnalysisOutput | null> {
  if (!openai) {
    console.error('OpenAI client not initialized')
    return null
  }

  try {
    const koreanPrompt = fillPrompt(TEAM_ANALYSIS_PROMPT, { teamData })
    const response = await openai.chat.completions.create({
      model: AI_MODELS.ANALYSIS,
      messages: [{ role: 'user', content: koreanPrompt }],
      max_tokens: TOKEN_LIMITS.TEAM_ANALYSIS,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const result = parseTeamAnalysis(content)

    if (includeEnglish) {
      const englishPrompt = fillPrompt(TEAM_ANALYSIS_PROMPT_EN, { teamData })
      const englishResponse = await openai.chat.completions.create({
        model: AI_MODELS.SUMMARY,
        messages: [{ role: 'user', content: englishPrompt }],
        max_tokens: TOKEN_LIMITS.TEAM_ANALYSIS,
        temperature: 0.7,
      })

      const englishContent = englishResponse.choices[0]?.message?.content
      if (englishContent) {
        const englishResult = parseTeamAnalysis(englishContent)
        result.analysisEn = englishResult.analysis
        result.tacticsEn = englishResult.tactics
      }
    }

    return result
  } catch (error) {
    console.error('Error generating team analysis:', error)
    return null
  }
}

function parseTeamAnalysis(content: string): TeamAnalysisOutput {
  const sections = content.split('##').map((s) => s.trim()).filter(Boolean)

  const result: TeamAnalysisOutput = {
    analysis: '',
    tactics: '',
    strengths: [],
    weaknesses: [],
  }

  for (const section of sections) {
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
    const title = lines[0]?.toLowerCase() || ''

    if (title.includes('패턴') || title.includes('pattern')) {
      result.analysis = lines.slice(1).join('\n')
    } else if (title.includes('전술') || title.includes('tactical') || title.includes('style')) {
      result.tactics = lines.slice(1).join('\n')
    } else if (title.includes('강점') || title.includes('strength')) {
      result.strengths = lines
        .slice(1)
        .filter((l) => /^\d+\./.test(l))
        .map((l) => l.replace(/^\d+\.\s*/, ''))
    } else if (title.includes('약점') || title.includes('weakness')) {
      result.weaknesses = lines
        .slice(1)
        .filter((l) => /^\d+\./.test(l))
        .map((l) => l.replace(/^\d+\.\s*/, ''))
    }
  }

  return result
}

// 데일리 리포트 생성
export async function generateDailyReport(
  dailyData: string,
  includeEnglish: boolean = true
): Promise<DailyReportOutput | null> {
  if (!openai) {
    console.error('OpenAI client not initialized')
    return null
  }

  try {
    const koreanPrompt = fillPrompt(DAILY_REPORT_PROMPT, { dailyData })
    const response = await openai.chat.completions.create({
      model: AI_MODELS.ANALYSIS,
      messages: [{ role: 'user', content: koreanPrompt }],
      max_tokens: TOKEN_LIMITS.ANALYSIS,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const result = parseDailyReport(content)

    if (includeEnglish) {
      const englishPrompt = fillPrompt(DAILY_REPORT_PROMPT_EN, { dailyData })
      const englishResponse = await openai.chat.completions.create({
        model: AI_MODELS.SUMMARY,
        messages: [{ role: 'user', content: englishPrompt }],
        max_tokens: TOKEN_LIMITS.ANALYSIS,
        temperature: 0.7,
      })

      const englishContent = englishResponse.choices[0]?.message?.content
      if (englishContent) {
        const englishResult = parseDailyReport(englishContent)
        result.summaryEn = englishResult.summary
      }
    }

    return result
  } catch (error) {
    console.error('Error generating daily report:', error)
    return null
  }
}

function parseDailyReport(content: string): DailyReportOutput {
  const result: DailyReportOutput = {
    summary: content,
    hotMatches: [],
    keyNews: [],
    insights: [],
  }

  const sections = content.split('###').map((s) => s.trim()).filter(Boolean)

  for (const section of sections) {
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
    const title = lines[0]?.toLowerCase() || ''

    if (title.includes('경기') || title.includes('match')) {
      // 주요 경기 파싱
      let currentMatch: { title: string; description: string } | null = null
      for (const line of lines.slice(1)) {
        if (line.startsWith('-') || line.startsWith('•')) {
          if (currentMatch) {
            result.hotMatches.push(currentMatch)
          }
          currentMatch = {
            title: line.replace(/^[-•]\s*/, ''),
            description: '',
          }
        } else if (currentMatch && line) {
          currentMatch.description += (currentMatch.description ? ' ' : '') + line
        }
      }
      if (currentMatch) {
        result.hotMatches.push(currentMatch)
      }
    } else if (title.includes('뉴스') || title.includes('news')) {
      // 뉴스 파싱
      let currentNews: { title: string; summary: string } | null = null
      for (const line of lines.slice(1)) {
        if (line.startsWith('-') || line.startsWith('•')) {
          if (currentNews) {
            result.keyNews.push(currentNews)
          }
          currentNews = {
            title: line.replace(/^[-•]\s*/, ''),
            summary: '',
          }
        } else if (currentNews && line) {
          currentNews.summary += (currentNews.summary ? ' ' : '') + line
        }
      }
      if (currentNews) {
        result.keyNews.push(currentNews)
      }
    } else if (title.includes('인사이트') || title.includes('insight')) {
      result.insights = lines
        .slice(1)
        .filter((l) => l.startsWith('-') || l.startsWith('•'))
        .map((l) => l.replace(/^[-•]\s*/, ''))
    }
  }

  return result
}
