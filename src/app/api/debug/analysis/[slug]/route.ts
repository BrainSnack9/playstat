import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Debug endpoint to check analysis data structure
// DELETE THIS FILE AFTER DEBUGGING
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const match = await prisma.match.findFirst({
      where: { slug },
      include: {
        matchAnalysis: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const analysis = match.matchAnalysis

    return NextResponse.json({
      matchId: match.id,
      slug: match.slug,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      hasAnalysis: !!analysis,
      analysis: analysis ? {
        id: analysis.id,
        // Direct fields
        hasSummary: !!analysis.summary,
        summaryPreview: analysis.summary?.substring(0, 100),
        hasSummaryEn: !!analysis.summaryEn,
        summaryEnPreview: analysis.summaryEn?.substring(0, 100),
        hasRecentFlowAnalysis: !!analysis.recentFlowAnalysis,
        hasSeasonTrends: !!analysis.seasonTrends,
        hasTacticalAnalysis: !!analysis.tacticalAnalysis,
        hasKeyPoints: !!analysis.keyPoints,
        keyPointsType: analysis.keyPoints ? typeof analysis.keyPoints : null,
        // Translations field
        hasTranslations: !!analysis.translations,
        translationsType: analysis.translations ? typeof analysis.translations : null,
        translationsKeys: analysis.translations ? Object.keys(analysis.translations as object) : [],
        translationsPreview: analysis.translations
          ? JSON.stringify(analysis.translations).substring(0, 500)
          : null,
      } : null,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
