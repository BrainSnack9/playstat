import MatchPageContent, { generateMatchMetadata, getCachedMatch } from '@/components/pages/match-page'
import { Metadata } from 'next'

const SPORT_ID = 'basketball'

interface Props {
  params: Promise<{ locale: string; slug: string }>
  searchParams?: Promise<{ from?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return generateMatchMetadata({ params, sport: SPORT_ID })
}

export default async function BasketballMatchPage({ params, searchParams }: Props) {
  return <MatchPageContent params={params} searchParams={searchParams} sport={SPORT_ID} />
}

export { getCachedMatch }
