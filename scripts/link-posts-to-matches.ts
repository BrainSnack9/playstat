import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 팀 이름 정규화
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
    .replace(/fc|cf|sc|afc|ac|as|ss|ssc/gi, '')
    .trim()
}

// 스포츠 접두사 (슬러그 앞에 올 수 있음)
const sportPrefixes = ['nba', 'nfl', 'mlb', 'nhl', 'football', 'basketball', 'baseball']

// 리그 키워드 (팀 이름 뒤에 올 수 있음)
const leagueKeywords = [
  'premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1',
  'champions-league', 'europa-league', 'conference-league',
  'fa-cup', 'carabao-cup', 'copa-del-rey', 'dfb-pokal', 'coppa-italia',
  'k-league', 'j-league', 'mls', 'efl-championship', 'segunda-division',
  'eredivisie', 'primeira-liga', 'super-lig', 'russian-premier-league',
  'scottish-premiership', 'belgian-pro-league', 'austrian-bundesliga',
  'swiss-super-league', 'greek-super-league', 'ukrainian-premier-league',
]

// 슬러그에서 팀 이름 추출
function extractTeamNamesFromSlug(slug: string): { home: string; away: string } | null {
  let workingSlug = slug

  // 1. 스포츠 접두사 제거
  for (const prefix of sportPrefixes) {
    if (workingSlug.startsWith(`${prefix}-`)) {
      workingSlug = workingSlug.slice(prefix.length + 1)
      break
    }
  }

  // 2. vs로 분리
  const vsParts = workingSlug.split('-vs-')
  if (vsParts.length !== 2) {
    return null
  }

  const homePart = vsParts[0]
  let awayPart = vsParts[1]

  // 3. 어웨이 팀 파트에서 리그/스포츠 키워드 및 카테고리 제거
  // 먼저 리그 키워드 제거
  for (const league of leagueKeywords) {
    const leagueIndex = awayPart.indexOf(`-${league}`)
    if (leagueIndex !== -1) {
      awayPart = awayPart.slice(0, leagueIndex)
      break
    }
  }

  // 스포츠 키워드가 팀 이름 뒤에 올 수도 있음 (예: team-vs-team-nba-preview)
  for (const sport of sportPrefixes) {
    const sportIndex = awayPart.indexOf(`-${sport}-`)
    if (sportIndex !== -1) {
      awayPart = awayPart.slice(0, sportIndex)
      break
    }
  }

  // 카테고리 키워드 제거 (preview, review, analysis 및 그 뒤의 해시)
  const categoryMatch = awayPart.match(/^(.+?)-(preview|review|analysis)(-[a-z0-9]+)?$/i)
  if (categoryMatch) {
    awayPart = categoryMatch[1]
  }

  const home = homePart.replace(/-/g, ' ').trim()
  const away = awayPart.replace(/-/g, ' ').trim()

  if (!home || !away) {
    return null
  }

  return { home, away }
}

async function main() {
  console.log('Starting to link blog posts to matches...')

  // matchId가 없는 PREVIEW/REVIEW 포스트 조회
  const unlinkedPosts = await prisma.blogPost.findMany({
    where: {
      matchId: null,
      category: { in: ['PREVIEW', 'REVIEW'] },
    },
    select: {
      id: true,
      slug: true,
      category: true,
      sportType: true,
      createdAt: true,
    },
  })

  console.log(`Found ${unlinkedPosts.length} unlinked posts`)

  // 모든 팀 조회
  const allTeams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
      sportType: true,
    },
  })

  // 팀 이름 맵 생성
  const teamNameMap = new Map<string, { id: string; sportType: string }>()
  for (const team of allTeams) {
    teamNameMap.set(normalizeTeamName(team.name), { id: team.id, sportType: team.sportType })
    if (team.shortName) {
      teamNameMap.set(normalizeTeamName(team.shortName), { id: team.id, sportType: team.sportType })
    }
  }

  let linked = 0
  let notFound = 0
  let errors = 0

  for (const post of unlinkedPosts) {
    try {
      const teamNames = extractTeamNamesFromSlug(post.slug)
      if (!teamNames) {
        console.log(`[SKIP] ${post.slug} - 팀 이름 추출 불가`)
        notFound++
        continue
      }

      const homeNormalized = normalizeTeamName(teamNames.home)
      const awayNormalized = normalizeTeamName(teamNames.away)

      const homeTeam = teamNameMap.get(homeNormalized)
      const awayTeam = teamNameMap.get(awayNormalized)

      if (!homeTeam || !awayTeam) {
        console.log(`[SKIP] ${post.slug} - 팀 없음: ${!homeTeam ? teamNames.home : ''} ${!awayTeam ? teamNames.away : ''}`)
        notFound++
        continue
      }

      // 경기 찾기 (생성일 기준 ±7일)
      const postDate = new Date(post.createdAt)
      const startDate = new Date(postDate)
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date(postDate)
      endDate.setDate(endDate.getDate() + 7)

      const match = await prisma.match.findFirst({
        where: {
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          kickoffAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          kickoffAt: post.category === 'PREVIEW' ? 'asc' : 'desc',
        },
      })

      if (!match) {
        console.log(`[SKIP] ${post.slug} - 경기 없음`)
        notFound++
        continue
      }

      // 연결
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { matchId: match.id },
      })

      console.log(`[LINKED] ${post.slug} -> ${match.id}`)
      linked++
    } catch (error) {
      console.log(`[ERROR] ${post.slug} - ${error}`)
      errors++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total: ${unlinkedPosts.length}`)
  console.log(`Linked: ${linked}`)
  console.log(`Not Found: ${notFound}`)
  console.log(`Errors: ${errors}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
