import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

    // 今日の日付を取得
    const today = new Date().toISOString().split('T')[0]

    // 今日復習すべき質問を取得
    // review_historyから最新の履歴を取得し、next_review_dateが今日以前のものを抽出
    const { data: reviewHistory, error: historyError } = await supabase
      .from('review_history')
      .select('question_id, next_review_date, interval_days, ease_factor, repetitions, reviewed_at, self_rating')
      .eq('user_id', user.id)
      .lte('next_review_date', today)
      .order('reviewed_at', { ascending: false })

    if (historyError) {
      console.error('Error fetching review history:', historyError)
      return NextResponse.json({ error: 'Failed to fetch review history' }, { status: 500 })
    }

    // question_idごとに最新の履歴のみを保持
    const latestReviewMap = new Map()
    reviewHistory?.forEach((review) => {
      if (!latestReviewMap.has(review.question_id)) {
        latestReviewMap.set(review.question_id, review)
      }
    })

    const questionIds = Array.from(latestReviewMap.keys())

    if (questionIds.length === 0) {
      return NextResponse.json({
        count: 0,
        questions: [],
      })
    }

    // 質問の詳細を取得
    const { data: questions, error: questionsError } = await supabase
      .from('review_questions')
      .select('*')
      .in('id', questionIds)

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    // 質問と最新の復習履歴を結合
    const questionsWithHistory = questions?.map((question) => ({
      ...question,
      last_review: latestReviewMap.get(question.id),
    }))

    return NextResponse.json({
      count: questionsWithHistory?.length || 0,
      questions: questionsWithHistory || [],
    })
  } catch (error) {
    console.error('Error in /api/reviews/today:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
