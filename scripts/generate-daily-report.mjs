import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TARGET_LOCALES = ['ko', 'ja', 'es', 'ar'];

function addUsageTotals(total, usage) {
  if (!usage) return;
  total.prompt += usage.prompt_tokens || 0;
  total.completion += usage.completion_tokens || 0;
}

async function translateJsonToLocale(englishData, locale, totals) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Translate the provided JSON content from English to natural ${locale === 'ko' ? 'Korean' : locale === 'ja' ? 'Japanese' : locale === 'es' ? 'Spanish' : 'Arabic'}. Return ONLY the translated JSON.`,
      },
      { role: 'user', content: JSON.stringify(englishData) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  addUsageTotals(totals, response.usage);
  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content);
}

function getUTCDayRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function formatDateEn(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

const DAILY_REPORT_PROMPT_EN = `You are a professional football analyst writing a daily match preview report.
Generate an SEO-optimized daily football report based on the match data provided.

## CRITICAL RULES (Absolute Zero Tolerance)
- NEVER mention betting, odds, probability, or predicted scores.
- DO NOT use any terminology related to gambling or wagering (e.g., "favorite", "underdog", "handicap", "line").
- This content will be served to global audiences including Arabic cultures where gambling is strictly prohibited. Keep the tone purely professional, analytical, and informative.

## Rules
- Focus on match previews, team form, and key storylines
- Use SEO-friendly language with relevant football keywords
- Make the content engaging and informative for football fans

## Output Format (JSON)
Return a valid JSON object with this structure:
{
  "title": "SEO Optimized Title (Date + Major matches, within 60 chars)",
  "metaDescription": "Meta description (mentioning major matches, within 155 chars)",
  "summary": "Key match insights (Sharp tactical/statistical analysis, 3 points in '1. Content \\n2. Content' format)",
  "sections": [
    {
      "type": "highlight_matches",
      "title": "Featured Matches of the Day",
      "content": "Previews for major matches (2-3 sentences per match)"
    },
    {
      "type": "league_overview",
      "title": "Matches by League",
      "content": "Summary of matches for each league"
    },
    {
      "type": "key_storylines",
      "title": "Key Storylines",
      "content": "Important storylines to watch today"
    },
    {
      "type": "team_focus",
      "title": "Teams in Focus",
      "content": "Teams to watch closely and why"
    }
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "..."],
  "hotMatches": [
    {
      "matchId": "matchID",
      "title": "Home Team vs Away Team",
      "preview": "Short preview (1-2 sentences)",
      "keyPoint": "Key viewing point"
    }
  ]
}

---
Today's date: {date}
Match data:
{matchData}`;

async function run() {
  const dateStr = process.argv[2] || new Date().toISOString().slice(0, 10);
  const { start, end } = getUTCDayRange(dateStr);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set.');
    process.exit(1);
  }

  const matches = await prisma.match.findMany({
    where: {
      kickoffAt: {
        gte: start,
        lte: end,
      },
      status: { in: ['SCHEDULED', 'TIMED', 'LIVE', 'FINISHED'] },
    },
    include: {
      league: true,
      homeTeam: { include: { seasonStats: true } },
      awayTeam: { include: { seasonStats: true } },
      matchAnalysis: true,
    },
    orderBy: { kickoffAt: 'asc' },
  });

  const matchData = matches.map((match) => ({
    id: match.id,
    league: match.league.name,
    leagueCode: match.league.code,
    kickoffAt: new Date(match.kickoffAt).toISOString().slice(11, 16),
    homeTeam: {
      name: match.homeTeam.name,
      rank: match.homeTeam.seasonStats?.rank,
      form: match.homeTeam.seasonStats?.form,
      points: match.homeTeam.seasonStats?.points,
    },
    awayTeam: {
      name: match.awayTeam.name,
      rank: match.awayTeam.seasonStats?.rank,
      form: match.awayTeam.seasonStats?.form,
      points: match.awayTeam.seasonStats?.points,
    },
    hasAnalysis: !!match.matchAnalysis,
    matchday: match.matchday,
  }));

  const matchesByLeague = matchData.reduce((acc, m) => {
    acc[m.league] = acc[m.league] || [];
    acc[m.league].push(m);
    return acc;
  }, {});

  const prompt = DAILY_REPORT_PROMPT_EN
    .replace('{date}', formatDateEn(start))
    .replace('{matchData}', JSON.stringify({
      totalMatches: matchData.length,
      matchesByLeague,
      allMatches: matchData,
    }, null, 2));

  const totals = { prompt: 0, completion: 0 };
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  addUsageTotals(totals, response.usage);
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);

  const reportData = {
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    summary: parsed.summary,
    sections: parsed.sections,
    keywords: parsed.keywords,
    hotMatches: parsed.hotMatches || [],
  };

  const translations = { en: reportData };
  for (const locale of TARGET_LOCALES) {
    try {
      translations[locale] = await translateJsonToLocale(reportData, locale, totals);
    } catch (e) {
      console.error(`Translation failed for ${locale}:`, e);
    }
  }

  const report = await prisma.dailyReport.upsert({
    where: { date: start },
    update: {
      translations,
      summary: JSON.stringify(reportData),
      hotMatches: parsed.hotMatches || [],
    },
    create: {
      date: start,
      sportType: 'FOOTBALL',
      translations,
      summary: JSON.stringify(reportData),
      hotMatches: parsed.hotMatches || [],
      keyNews: [],
      insights: parsed.sections?.find((s) => s.type === 'key_storylines')?.content || null,
    },
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3030';
  if (process.env.CRON_SECRET) {
    try {
      const res = await fetch(`${siteUrl}/api/revalidate?tag=daily-report&secret=${encodeURIComponent(process.env.CRON_SECRET)}`);
      if (!res.ok) {
        console.warn(`Revalidate failed: ${res.status}`);
      }
    } catch (e) {
      console.warn('Revalidate request failed:', e);
    }
  }

  const inputRate = Number(process.env.GPT_4O_MINI_INPUT_PER_1M || 0.15);
  const outputRate = Number(process.env.GPT_4O_MINI_OUTPUT_PER_1M || 0.60);
  const inputCost = (totals.prompt / 1_000_000) * inputRate;
  const outputCost = (totals.completion / 1_000_000) * outputRate;
  const totalCost = inputCost + outputCost;

  console.log(`Generated daily report for ${dateStr} (UTC) -> id: ${report.id}`);
  console.log(`Token usage: prompt=${totals.prompt}, completion=${totals.completion}, total=${totals.prompt + totals.completion}`);
  console.log(`Estimated cost (gpt-4o-mini): $${totalCost.toFixed(6)} (input $${inputCost.toFixed(6)} + output $${outputCost.toFixed(6)})`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
