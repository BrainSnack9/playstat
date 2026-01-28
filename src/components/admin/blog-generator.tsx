'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Calendar,
  Trophy,
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface MatchInfo {
  id: string
  homeTeam: { name: string; rank?: number; points?: number }
  awayTeam: { name: string; rank?: number; points?: number }
  league: { name: string; code: string }
  kickoffAt: string
  status: string
  homeScore?: number
  awayScore?: number
  hasExistingPost: boolean
}

type SportType = 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'
type Category = 'PREVIEW' | 'REVIEW'

const sportConfig = [
  { id: 'FOOTBALL' as SportType, label: '⚽ 축구', color: 'text-lime-400' },
  { id: 'BASKETBALL' as SportType, label: '🏀 농구', color: 'text-orange-400' },
  { id: 'BASEBALL' as SportType, label: '⚾ 야구', color: 'text-emerald-400' },
]

const categoryConfig = [
  { id: 'PREVIEW' as Category, label: '프리뷰', description: '예정 경기' },
  { id: 'REVIEW' as Category, label: '리뷰', description: '종료 경기' },
]

export function BlogGenerator() {
  const [sport, setSport] = useState<SportType>('FOOTBALL')
  const [category, setCategory] = useState<Category>('PREVIEW')
  const [matches, setMatches] = useState<MatchInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, { success: boolean; message: string; postId?: string }>>({})

  const fetchMatches = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/blog/available-matches?sport=${sport}&category=${category}`)
      const data = await res.json()
      if (res.ok) {
        setMatches(data.matches || [])
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [sport, category])

  const generatePost = async (matchId: string) => {
    setGenerating(prev => ({ ...prev, [matchId]: true }))
    setResults(prev => ({ ...prev, [matchId]: undefined as unknown as { success: boolean; message: string } }))

    try {
      const res = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, category }),
      })

      const data = await res.json()

      if (res.ok) {
        setResults(prev => ({
          ...prev,
          [matchId]: { success: true, message: '생성 완료', postId: data.post?.id },
        }))
        // 목록 새로고침
        fetchMatches()
      } else {
        setResults(prev => ({
          ...prev,
          [matchId]: { success: false, message: data.error || '생성 실패' },
        }))
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [matchId]: { success: false, message: '네트워크 오류' },
      }))
    } finally {
      setGenerating(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const availableMatches = matches.filter(m => !m.hasExistingPost)
  const existingMatches = matches.filter(m => m.hasExistingPost)

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              블로그 포스트 수동 생성
            </CardTitle>
            <CardDescription className="text-gray-500">
              생성할 경기를 선택하세요. DRAFT 상태로 저장됩니다.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMatches}
            disabled={loading}
            className="border-gray-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 필터 */}
        <div className="flex flex-wrap gap-4">
          {/* 스포츠 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">스포츠:</span>
            <div className="flex gap-1">
              {sportConfig.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSport(s.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    sport === s.id
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">타입:</span>
            <div className="flex gap-1">
              {categoryConfig.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    category === c.id
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        )}

        {/* 생성 가능한 경기 목록 */}
        {!loading && availableMatches.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">
              생성 가능 ({availableMatches.length})
            </h4>
            <div className="space-y-2">
              {availableMatches.map(match => {
                const isGenerating = generating[match.id]
                const result = results[match.id]

                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white font-medium truncate">
                          {match.homeTeam.name}
                        </span>
                        {match.homeTeam.rank && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-gray-400 border-gray-600">
                            {match.homeTeam.rank}위
                          </Badge>
                        )}
                        <span className="text-gray-500">vs</span>
                        <span className="text-white font-medium truncate">
                          {match.awayTeam.name}
                        </span>
                        {match.awayTeam.rank && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-gray-400 border-gray-600">
                            {match.awayTeam.rank}위
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Trophy className="w-3 h-3" />
                        <span>{match.league.name}</span>
                        <span className="text-gray-600">•</span>
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(match.kickoffAt), 'M/d HH:mm', { locale: ko })}</span>
                        {category === 'REVIEW' && match.homeScore !== undefined && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="text-white">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {result && (
                        <div className="flex items-center gap-1">
                          {result.success ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              {result.postId && (
                                <a
                                  href={`/admin/posts/${result.postId}/edit`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:underline flex items-center gap-0.5"
                                >
                                  편집 <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-400" />
                              <span className="text-xs text-red-400">{result.message}</span>
                            </>
                          )}
                        </div>
                      )}

                      <Button
                        size="sm"
                        onClick={() => generatePost(match.id)}
                        disabled={isGenerating}
                        className="h-7 px-3 text-xs"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            생성 중
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            생성
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 이미 생성된 경기 */}
        {!loading && existingMatches.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">
              이미 생성됨 ({existingMatches.length})
            </h4>
            <div className="space-y-1">
              {existingMatches.slice(0, 5).map(match => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-2 bg-gray-800/30 rounded border border-gray-800"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle2 className="w-3 h-3 text-green-500/50" />
                    <span>{match.homeTeam.name} vs {match.awayTeam.name}</span>
                    <span className="text-gray-600">({match.league.name})</span>
                  </div>
                </div>
              ))}
              {existingMatches.length > 5 && (
                <p className="text-xs text-gray-600 pl-2">
                  외 {existingMatches.length - 5}개...
                </p>
              )}
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && matches.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            생성 가능한 경기가 없습니다.
          </div>
        )}

        {!loading && availableMatches.length === 0 && existingMatches.length > 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            모든 빅매치에 대한 포스트가 이미 생성되었습니다.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
