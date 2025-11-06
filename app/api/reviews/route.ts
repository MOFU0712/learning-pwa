import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateNextReview } from '@/lib/sm2-algorithm'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { question_id, self_rating, reviewed_at } = body

    // バリデーション
    if (!question_id || !self_rating || self_rating < 1 || self_rating > 5) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // 最新の復習履歴を取得
    const { data: latestReview } = await supabase
      .from('review_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', question_id)
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .single()

    // SM-2アルゴリズムで次回復習日を計算
    const currentInterval = latestReview?.interval_days || 1
    const currentEaseFactor = latestReview?.ease_factor || 2.5
    const repetitions = latestReview?.repetitions || 0

    const nextReview = calculateNextReview({
      questionId: question_id,
      rating: self_rating,
      currentInterval,
      currentEaseFactor,
      repetitions,
    })

    // 復習履歴を記録
    const { data: newReview, error: insertError } = await supabase
      .from('review_history')
      .insert({
        user_id: user.id,
        question_id,
        reviewed_at: reviewed_at || new Date().toISOString(),
        self_rating,
        next_review_date: nextReview.nextReviewDate.toISOString().split('T')[0],
        interval_days: nextReview.interval,
        ease_factor: nextReview.easeFactor,
        repetitions: nextReview.repetitions,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting review history:', insertError)
      return NextResponse.json({ error: 'Failed to record review' }, { status: 500 })
    }

    return NextResponse.json({
      next_review_date: nextReview.nextReviewDate.toISOString().split('T')[0],
      interval_days: nextReview.interval,
      ease_factor: nextReview.easeFactor,
      repetitions: nextReview.repetitions,
    })
  } catch (error) {
    console.error('Error in /api/reviews:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
