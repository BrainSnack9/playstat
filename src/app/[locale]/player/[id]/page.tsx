import { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Link } from '@/i18n/routing'
import {
  User,
  MapPin,
  Calendar,
  Ruler,
  Scale,
  Trophy,
} from 'lucide-react'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

// Demo player data
const playerData: Record<string, {
  id: string
  name: string
  position: string
  nationality: string
  birthDate: string
  height: number
  weight: number
  number: number
  photoUrl?: string
  team: { id: string; name: string; logoUrl?: string }
  stats: {
    appearances: number
    goals: number
    assists: number
    rating?: number
  }
}> = {
  '101': {
    id: '101',
    name: 'Bukayo Saka',
    position: 'RW',
    nationality: 'England',
    birthDate: '2001-09-05',
    height: 178,
    weight: 72,
    number: 7,
    team: { id: '1', name: 'Arsenal' },
    stats: {
      appearances: 25,
      goals: 10,
      assists: 8,
      rating: 7.5,
    },
  },
  '102': {
    id: '102',
    name: 'Martin Odegaard',
    position: 'CAM',
    nationality: 'Norway',
    birthDate: '1998-12-17',
    height: 178,
    weight: 68,
    number: 8,
    team: { id: '1', name: 'Arsenal' },
    stats: {
      appearances: 22,
      goals: 7,
      assists: 10,
      rating: 7.8,
    },
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const player = playerData[id]

  if (!player) {
    return { title: 'Player Not Found' }
  }

  return {
    title: `${player.name} - ${player.team.name}`,
    description: `${player.name} 선수 정보 및 통계. ${player.position}, ${player.nationality}`,
  }
}

export default async function PlayerPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const player = playerData[id]

  if (!player) {
    notFound()
  }

  const birthYear = new Date(player.birthDate).getFullYear()
  const age = new Date().getFullYear() - birthYear

  return (
    <div className="container py-8">
      {/* Player Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
              <User className="h-16 w-16 text-primary" />
            </div>

            <div className="flex-1 text-center md:text-left">
              <Link
                href={`/team/${player.team.id}`}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                <Trophy className="mr-1 inline h-4 w-4" />
                {player.team.name}
              </Link>
              <h1 className="text-3xl font-bold">{player.name}</h1>
              <div className="mt-2 flex flex-wrap justify-center gap-2 md:justify-start">
                <Badge variant="outline" className="text-lg">
                  #{player.number}
                </Badge>
                <Badge>{player.position}</Badge>
                <Badge variant="secondary">{player.nationality}</Badge>
              </div>
            </div>

            {player.stats.rating && (
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">
                  {player.stats.rating.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">평균 평점</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle>선수 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                국적
              </span>
              <span className="font-medium">{player.nationality}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="flex items-center text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                나이
              </span>
              <span className="font-medium">{age}세</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="flex items-center text-muted-foreground">
                <Ruler className="mr-2 h-4 w-4" />
                키
              </span>
              <span className="font-medium">{player.height}cm</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="flex items-center text-muted-foreground">
                <Scale className="mr-2 h-4 w-4" />
                몸무게
              </span>
              <span className="font-medium">{player.weight}kg</span>
            </div>
          </CardContent>
        </Card>

        {/* Season Stats */}
        <Card>
          <CardHeader>
            <CardTitle>시즌 통계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-3xl font-bold">{player.stats.appearances}</div>
                <div className="text-sm text-muted-foreground">출전</div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-3xl font-bold">{player.stats.goals}</div>
                <div className="text-sm text-muted-foreground">골</div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-3xl font-bold">{player.stats.assists}</div>
                <div className="text-sm text-muted-foreground">도움</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
