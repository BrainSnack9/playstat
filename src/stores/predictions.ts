'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SportType = 'FOOTBALL' | 'BASKETBALL' | 'BASEBALL'

export interface Prediction {
  matchId: string
  homeScore: number
  awayScore: number
  predictedAt: string // ISO date
  sportType?: SportType
  // 경기 결과 (경기 종료 후 업데이트)
  actualHomeScore?: number
  actualAwayScore?: number
  points?: number
  settled?: boolean
}

interface PredictionStats {
  totalPredictions: number
  totalPoints: number
  exactMatches: number // 정확히 맞춘 횟수
  correctWinner: number // 승무패만 맞춘 횟수
  correctDiff: number // 골차 맞춘 횟수
  currentStreak: number // 연속 적중 (승무패 기준)
  bestStreak: number
}

interface PredictionsState {
  predictions: Prediction[]
  stats: PredictionStats

  // Actions
  addPrediction: (matchId: string, homeScore: number, awayScore: number, sportType?: SportType) => void
  updatePrediction: (matchId: string, homeScore: number, awayScore: number) => void
  removePrediction: (matchId: string) => void
  getPrediction: (matchId: string) => Prediction | undefined
  hasPrediction: (matchId: string) => boolean

  // 경기 결과 처리
  settlePrediction: (matchId: string, actualHomeScore: number, actualAwayScore: number, sportType?: SportType) => void

  // 통계 계산
  recalculateStats: () => void
}

// 점수 계산 결과 타입
export type PointType = 'exact' | 'close5' | 'close10' | 'diff' | 'winner' | 'miss'

// 점수 계산 함수 (스포츠 타입별 차등)
function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  sportType: SportType = 'FOOTBALL'
): { points: number; type: PointType } {
  const isHighScoreSport = sportType === 'BASKETBALL' || sportType === 'BASEBALL'

  // 정확히 맞춤
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { points: isHighScoreSport ? 5 : 3, type: 'exact' }
  }

  if (isHighScoreSport) {
    // 농구/야구: 완화된 기준
    const homeDiff = Math.abs(predictedHome - actualHome)
    const awayDiff = Math.abs(predictedAway - actualAway)

    // 양팀 점수 각각 ±5점 이내: 3점
    if (homeDiff <= 5 && awayDiff <= 5) {
      return { points: 3, type: 'close5' }
    }

    // 양팀 점수 각각 ±10점 이내: 2점
    if (homeDiff <= 10 && awayDiff <= 10) {
      return { points: 2, type: 'close10' }
    }

    // 승패만 맞춤: 1점
    const predictedResult = predictedHome > predictedAway ? 'home' : predictedHome < predictedAway ? 'away' : 'draw'
    const actualResult = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw'
    if (predictedResult === actualResult) {
      return { points: 1, type: 'winner' }
    }
  } else {
    // 축구: 기존 로직
    // 골차 맞춤: 2점
    const predictedDiff = predictedHome - predictedAway
    const actualDiff = actualHome - actualAway
    if (predictedDiff === actualDiff) {
      return { points: 2, type: 'diff' }
    }

    // 승무패 맞춤: 1점
    const predictedResult = predictedHome > predictedAway ? 'home' : predictedHome < predictedAway ? 'away' : 'draw'
    const actualResult = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw'
    if (predictedResult === actualResult) {
      return { points: 1, type: 'winner' }
    }
  }

  // 틀림: 0점
  return { points: 0, type: 'miss' }
}

export const usePredictions = create<PredictionsState>()(
  persist(
    (set, get) => ({
      predictions: [],
      stats: {
        totalPredictions: 0,
        totalPoints: 0,
        exactMatches: 0,
        correctWinner: 0,
        correctDiff: 0,
        currentStreak: 0,
        bestStreak: 0,
      },

      addPrediction: (matchId: string, homeScore: number, awayScore: number, sportType?: SportType) => {
        const existing = get().predictions.find(p => p.matchId === matchId)
        if (existing) {
          get().updatePrediction(matchId, homeScore, awayScore)
          return
        }

        set((state) => ({
          predictions: [
            ...state.predictions,
            {
              matchId,
              homeScore,
              awayScore,
              sportType,
              predictedAt: new Date().toISOString(),
            },
          ],
        }))
      },

      updatePrediction: (matchId: string, homeScore: number, awayScore: number) => {
        set((state) => ({
          predictions: state.predictions.map((p) =>
            p.matchId === matchId && !p.settled
              ? { ...p, homeScore, awayScore, predictedAt: new Date().toISOString() }
              : p
          ),
        }))
      },

      removePrediction: (matchId: string) => {
        set((state) => ({
          predictions: state.predictions.filter(
            (p) => p.matchId !== matchId || p.settled
          ),
        }))
      },

      getPrediction: (matchId: string) => {
        return get().predictions.find((p) => p.matchId === matchId)
      },

      hasPrediction: (matchId: string) => {
        return get().predictions.some((p) => p.matchId === matchId)
      },

      settlePrediction: (matchId: string, actualHomeScore: number, actualAwayScore: number, sportType?: SportType) => {
        const prediction = get().predictions.find((p) => p.matchId === matchId)
        if (!prediction || prediction.settled) return

        const { points } = calculatePoints(
          prediction.homeScore,
          prediction.awayScore,
          actualHomeScore,
          actualAwayScore,
          sportType || prediction.sportType || 'FOOTBALL'
        )

        set((state) => ({
          predictions: state.predictions.map((p) =>
            p.matchId === matchId
              ? {
                  ...p,
                  actualHomeScore,
                  actualAwayScore,
                  points,
                  settled: true,
                }
              : p
          ),
        }))

        // 통계 업데이트
        get().recalculateStats()
      },

      recalculateStats: () => {
        const predictions = get().predictions.filter((p) => p.settled)

        let totalPoints = 0
        let exactMatches = 0
        let correctWinner = 0
        let correctDiff = 0
        let currentStreak = 0
        let bestStreak = 0
        let tempStreak = 0

        // 시간순 정렬
        const sorted = [...predictions].sort(
          (a, b) => new Date(a.predictedAt).getTime() - new Date(b.predictedAt).getTime()
        )

        for (const p of sorted) {
          if (p.points === undefined) continue

          totalPoints += p.points

          if (p.points === 3) exactMatches++
          else if (p.points === 2) correctDiff++
          else if (p.points === 1) correctWinner++

          // 스트릭 계산 (승무패 맞춘 경우)
          if (p.points >= 1) {
            tempStreak++
            if (tempStreak > bestStreak) bestStreak = tempStreak
          } else {
            tempStreak = 0
          }
        }

        // 현재 스트릭: 마지막 예측부터 역순으로 계산
        currentStreak = 0
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (sorted[i].points && sorted[i].points! >= 1) {
            currentStreak++
          } else {
            break
          }
        }

        set({
          stats: {
            totalPredictions: predictions.length,
            totalPoints,
            exactMatches,
            correctWinner,
            correctDiff,
            currentStreak,
            bestStreak,
          },
        })
      },
    }),
    {
      name: 'score-predictions',
    }
  )
)

// 점수 계산 헬퍼 함수 export
export { calculatePoints }
