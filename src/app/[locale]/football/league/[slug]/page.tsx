import LeaguePageContent, { generateLeagueMetadata, getCachedLeagueData } from '@/components/pages/league-page'
import { Metadata } from 'next'

const SPORT_ID = 'football'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return generateLeagueMetadata({ params, sport: SPORT_ID })
}

export default async function FootballLeaguePage({ params }: Props) {
  return <LeaguePageContent params={params} sport={SPORT_ID} />
}

export { getCachedLeagueData }
