/**
 * SM-2アルゴリズム実装
 * 間隔反復学習（Spaced Repetition）のためのアルゴリズム
 */

export interface ReviewResult {
  questionId: string
  rating: number // 1-5
  currentInterval: number // 現在の間隔（日数）
  currentEaseFactor: number // 現在の容易さ係数
  repetitions: number // 繰り返し回数
}

export interface NextReview {
  nextReviewDate: Date
  interval: number // 次回の間隔（日数）
  easeFactor: number // 次回の容易さ係数
  repetitions: number // 更新後の繰り返し回数
}

/**
 * SM-2アルゴリズムに基づいて次回復習日を計算
 *
 * @param result - 復習結果
 * @returns 次回復習情報
 */
export function calculateNextReview(result: ReviewResult): NextReview {
  const { rating, currentInterval, currentEaseFactor, repetitions } = result

  let newInterval: number
  let newEaseFactor: number
  let newRepetitions: number

  // rating < 3 の場合は間隔をリセット
  if (rating < 3) {
    newInterval = 1
    newRepetitions = 0
    newEaseFactor = currentEaseFactor
  } else {
    // rating >= 3 の場合は間隔を延ばす
    newRepetitions = repetitions + 1

    // 容易さ係数を更新
    newEaseFactor = currentEaseFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))

    // 容易さ係数の最小値は1.3
    if (newEaseFactor < 1.3) {
      newEaseFactor = 1.3
    }

    // 間隔を計算
    if (newRepetitions === 1) {
      newInterval = 1
    } else if (newRepetitions === 2) {
      newInterval = 6
    } else {
      newInterval = Math.round(currentInterval * newEaseFactor)
    }
  }

  // 次回復習日を計算
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)
  // 時刻をリセット（日付のみを扱う）
  nextReviewDate.setHours(0, 0, 0, 0)

  return {
    nextReviewDate,
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
  }
}

/**
 * 初回復習の初期値を取得
 *
 * @returns 初回復習情報
 */
export function getInitialReview(): Omit<NextReview, 'nextReviewDate'> & { nextReviewDate: string } {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  return {
    nextReviewDate: tomorrow.toISOString().split('T')[0], // YYYY-MM-DD
    interval: 1,
    easeFactor: 2.5, // 初期値
    repetitions: 0,
  }
}

/**
 * 今日の復習が必要かどうかを判定
 *
 * @param nextReviewDate - 次回復習日（YYYY-MM-DD形式）
 * @returns 今日の復習が必要な場合はtrue
 */
export function isReviewDueToday(nextReviewDate: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const reviewDate = new Date(nextReviewDate)
  reviewDate.setHours(0, 0, 0, 0)

  return reviewDate <= today
}

/**
 * レーティングに基づく推奨間隔の例を取得（参考用）
 * SPEC.mdより:
 * - rating 5: 1日 → 6日 → 14日 → 30日 → 90日 → 180日
 * - rating 4: 1日 → 4日 → 10日 → 21日 → 60日 → 120日
 * - rating 3: 1日 → 3日 → 7日 → 14日 → 30日 → 60日
 * - rating 1-2: 1日にリセット
 */
export function getRecommendedIntervalExample(rating: number, repetition: number): number {
  if (rating < 3) {
    return 1
  }

  const intervals: Record<number, number[]> = {
    5: [1, 6, 14, 30, 90, 180],
    4: [1, 4, 10, 21, 60, 120],
    3: [1, 3, 7, 14, 30, 60],
  }

  const ratingIntervals = intervals[rating] || intervals[3]
  const index = Math.min(repetition, ratingIntervals.length - 1)

  return ratingIntervals[index]
}
