'use client'

import Image from 'next/image'
import { Clock } from 'lucide-react'

interface ScoreboardProps {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  homeLogo?: string | null
  awayLogo?: string | null
  homeRank?: number | null
  awayRank?: number | null
  onHomeScoreChange: (score: number) => void
  onAwayScoreChange: (score: number) => void
  matchTime?: string
  timeRemaining?: string
  league?: string
  leagueLogo?: string | null
  isLocked?: boolean
  sportType?: 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'
}

// 순위별 배지 스타일
function getRankBadgeStyle(rank: number): string {
  if (rank <= 5) {
    return 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50' // 1~5위: 골드
  } else if (rank <= 11) {
    return 'bg-blue-500/30 text-blue-400 border-blue-500/50' // 6~11위: 블루
  } else {
    return 'bg-gray-500/30 text-gray-400 border-gray-500/50' // 12위~: 회색
  }
}

export function Scoreboard3D({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeLogo,
  awayLogo,
  homeRank,
  awayRank,
  onHomeScoreChange,
  onAwayScoreChange,
  timeRemaining,
  league,
  leagueLogo,
  isLocked,
  sportType = 'FOOTBALL',
}: ScoreboardProps) {
  // 축구: +/- 버튼, 농구/야구: 직접 입력
  const isHighScoreSport = sportType === 'BASKETBALL' || sportType === 'BASEBALL'
  const maxScore = isHighScoreSport ? 999 : 15
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black relative border border-white/10">
      {/* 배경 글로우 효과 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/4 w-48 md:w-64 h-48 md:h-64 bg-blue-600/30 rounded-full blur-[60px] md:blur-[80px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-48 md:w-64 h-48 md:h-64 bg-red-600/30 rounded-full blur-[60px] md:blur-[80px] -translate-y-1/2" />
      </div>

      <div className="relative z-10 p-4 md:p-8">
        {/* 상단 정보 바 */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          {/* 리그 - 좌측 */}
          <div className="flex items-center gap-1.5">
            {leagueLogo ? (
              <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-white p-0.5 flex items-center justify-center">
                <Image src={leagueLogo} alt={league || ''} width={20} height={20} className="w-full h-full object-contain" />
              </div>
            ) : (
              <span className="text-sm">⚽</span>
            )}
            <span className="text-xs md:text-sm text-gray-300 font-medium">{league}</span>
          </div>

          {/* 경기까지 남은 시간 - 우측 */}
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-full">
            <Clock className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] md:text-xs text-orange-400 font-medium">{timeRemaining}</span>
          </div>
        </div>

        {/* 메인 스코어보드 */}
        <div className="flex items-center justify-center">
          {/* 홈팀 */}
          <div className="flex-1 text-center min-w-0">
            <div className="text-[10px] text-blue-400 font-bold tracking-wider mb-1">HOME</div>
            <div className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-4">
              {homeLogo ? (
                <div className="w-full h-full rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-1.5 md:p-3 border border-blue-500/30">
                  <Image
                    src={homeLogo}
                    alt={homeTeam}
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-full rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/30">
                  <span className="text-sm md:text-xl font-black text-blue-400">
                    {homeTeam.substring(0, 3).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5 px-1">
              {homeRank && (
                <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRankBadgeStyle(homeRank)}`}>
                  #{homeRank}
                </span>
              )}
              <span className="text-white font-semibold text-[11px] md:text-sm truncate">{homeTeam}</span>
            </div>
          </div>

          {/* 스코어 영역 */}
          <div className="flex items-center gap-1 md:gap-3 px-2 md:px-4">
            {/* 홈 스코어 */}
            <div className="flex flex-col items-center gap-1 md:gap-2">
              {!isLocked && !isHighScoreSport && (
                <button
                  onClick={() => onHomeScoreChange(Math.min(homeScore + 1, maxScore))}
                  className="w-7 h-5 md:w-10 md:h-7 bg-blue-500/30 hover:bg-blue-500/50 rounded text-blue-400 text-sm md:text-base font-bold transition-all active:scale-95"
                >
                  +
                </button>
              )}
              {isHighScoreSport && !isLocked ? (
                <input
                  type="number"
                  inputMode="numeric"
                  value={homeScore || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    onHomeScoreChange(Math.min(Math.max(val, 0), maxScore))
                  }}
                  className="w-16 h-16 md:w-24 md:h-28 bg-gradient-to-b from-[#1a1a4e] to-[#0a0a2a] rounded-lg md:rounded-xl text-center text-2xl md:text-4xl font-black text-blue-400 font-mono tabular-nums border-2 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)] focus:outline-none focus:border-blue-400"
                  placeholder="0"
                />
              ) : (
                <div className="w-12 h-16 md:w-20 md:h-28 bg-gradient-to-b from-[#1a1a4e] to-[#0a0a2a] rounded-lg md:rounded-xl flex items-center justify-center border-2 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <span className="text-3xl md:text-5xl font-black text-blue-400 font-mono tabular-nums">
                    {homeScore}
                  </span>
                </div>
              )}
              {!isLocked && !isHighScoreSport && (
                <button
                  onClick={() => onHomeScoreChange(Math.max(homeScore - 1, 0))}
                  className="w-7 h-5 md:w-10 md:h-7 bg-blue-500/30 hover:bg-blue-500/50 rounded text-blue-400 text-sm md:text-base font-bold transition-all active:scale-95"
                >
                  -
                </button>
              )}
            </div>

            {/* VS */}
            <div className="text-xl md:text-3xl font-black text-white/40 px-1">:</div>

            {/* 어웨이 스코어 */}
            <div className="flex flex-col items-center gap-1 md:gap-2">
              {!isLocked && !isHighScoreSport && (
                <button
                  onClick={() => onAwayScoreChange(Math.min(awayScore + 1, maxScore))}
                  className="w-7 h-5 md:w-10 md:h-7 bg-red-500/30 hover:bg-red-500/50 rounded text-red-400 text-sm md:text-base font-bold transition-all active:scale-95"
                >
                  +
                </button>
              )}
              {isHighScoreSport && !isLocked ? (
                <input
                  type="number"
                  inputMode="numeric"
                  value={awayScore || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    onAwayScoreChange(Math.min(Math.max(val, 0), maxScore))
                  }}
                  className="w-16 h-16 md:w-24 md:h-28 bg-gradient-to-b from-[#4e1a1a] to-[#2a0a0a] rounded-lg md:rounded-xl text-center text-2xl md:text-4xl font-black text-red-400 font-mono tabular-nums border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] focus:outline-none focus:border-red-400"
                  placeholder="0"
                />
              ) : (
                <div className="w-12 h-16 md:w-20 md:h-28 bg-gradient-to-b from-[#4e1a1a] to-[#2a0a0a] rounded-lg md:rounded-xl flex items-center justify-center border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <span className="text-3xl md:text-5xl font-black text-red-400 font-mono tabular-nums">
                    {awayScore}
                  </span>
                </div>
              )}
              {!isLocked && !isHighScoreSport && (
                <button
                  onClick={() => onAwayScoreChange(Math.max(awayScore - 1, 0))}
                  className="w-7 h-5 md:w-10 md:h-7 bg-red-500/30 hover:bg-red-500/50 rounded text-red-400 text-sm md:text-base font-bold transition-all active:scale-95"
                >
                  -
                </button>
              )}
            </div>
          </div>

          {/* 어웨이팀 */}
          <div className="flex-1 text-center min-w-0">
            <div className="text-[10px] text-red-400 font-bold tracking-wider mb-1">AWAY</div>
            <div className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-4">
              {awayLogo ? (
                <div className="w-full h-full rounded-lg md:rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 p-1.5 md:p-3 border border-red-500/30">
                  <Image
                    src={awayLogo}
                    alt={awayTeam}
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-full rounded-lg md:rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/30">
                  <span className="text-sm md:text-xl font-black text-red-400">
                    {awayTeam.substring(0, 3).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5 px-1">
              {awayRank && (
                <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRankBadgeStyle(awayRank)}`}>
                  #{awayRank}
                </span>
              )}
              <span className="text-white font-semibold text-[11px] md:text-sm truncate">{awayTeam}</span>
            </div>
          </div>
        </div>

        {/* 모바일 안내 */}
        <div className="text-center mt-4 md:hidden">
          <span className="text-[10px] text-gray-500">
            {isHighScoreSport ? '점수를 직접 입력하세요' : '+/- 버튼으로 점수 예측'}
          </span>
        </div>

        {/* 점수 가이드 */}
        <div className="mt-6 px-4 py-3 bg-white/5 rounded-lg border border-white/10">
          <div className="text-[10px] md:text-xs text-gray-400 font-medium mb-2 text-center">
            {isHighScoreSport ? '🏀 점수 규칙' : '⚽ 점수 규칙'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] md:text-xs">
            {isHighScoreSport ? (
              <>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold">5</span>
                  <span className="text-gray-400">정확히 맞춤</span>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">3</span>
                  <span className="text-gray-400">±5점 이내</span>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-green-500/20 text-green-400 flex items-center justify-center font-bold">2</span>
                  <span className="text-gray-400">±10점 이내</span>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-gray-500/20 text-gray-400 flex items-center justify-center font-bold">1</span>
                  <span className="text-gray-400">승패 맞춤</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold">3</span>
                  <span className="text-gray-400">정확히 맞춤</span>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">2</span>
                  <span className="text-gray-400">골차 맞춤</span>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-green-500/20 text-green-400 flex items-center justify-center font-bold">1</span>
                  <span className="text-gray-400">승무패 맞춤</span>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold">0</span>
                  <span className="text-gray-400">틀림</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
