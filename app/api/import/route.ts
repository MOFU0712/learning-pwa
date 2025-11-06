import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInitialReview } from '@/lib/sm2-algorithm'

interface ImportData {
  date: string
  project: string
  title?: string
  author?: string
  chapter?: number
  chapter_title?: string
  topic?: string
  duration_minutes?: number
  understanding_level?: number
  key_concepts?: string[]
  review_questions?: Array<{
    question: string
    answer: string
    explanation?: string
    why_important?: string
    related_concepts?: string[]
    difficulty_level?: number
  }>
}

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
    const data: ImportData = body.data

    if (!data || !data.project || !data.date) {
      return NextResponse.json({ error: 'Invalid input: project and date are required' }, { status: 400 })
    }

    // プロジェクトを検索または作成
    let { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', data.project)
      .single()

    if (projectError && projectError.code === 'PGRST116') {
      // プロジェクトが存在しない場合は作成
      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: data.project,
          title: data.title || data.project,
          author: data.author,
          current_chapter: data.chapter || 1,
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating project:', createError)
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
      }

      project = newProject
    } else if (projectError) {
      console.error('Error fetching project:', projectError)
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
    }

    // 学習セッションを作成
    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .insert({
        user_id: user.id,
        project_id: project!.id,
        date: data.date,
        chapter: data.chapter,
        chapter_title: data.chapter_title,
        topic: data.topic,
        duration_minutes: data.duration_minutes,
        understanding_level: data.understanding_level,
        key_concepts: data.key_concepts,
        raw_data: data,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // 復習質問を作成
    if (data.review_questions && data.review_questions.length > 0) {
      const questions = data.review_questions.map((q) => ({
        user_id: user.id,
        session_id: session.id,
        project_id: project!.id,
        question: q.question,
        answer: q.answer,
        explanation: q.explanation,
        why_important: q.why_important,
        difficulty_level: q.difficulty_level,
        related_concepts: q.related_concepts,
      }))

      const { data: createdQuestions, error: questionsError } = await supabase
        .from('review_questions')
        .insert(questions)
        .select()

      if (questionsError) {
        console.error('Error creating questions:', questionsError)
        return NextResponse.json({ error: 'Failed to create questions' }, { status: 500 })
      }

      // 各質問の初回復習履歴を作成
      const initialReview = getInitialReview()
      const reviewHistories = createdQuestions.map((question) => ({
        user_id: user.id,
        question_id: question.id,
        reviewed_at: new Date().toISOString(),
        self_rating: 3, // 初回は中間値
        next_review_date: initialReview.nextReviewDate,
        interval_days: initialReview.interval,
        ease_factor: initialReview.easeFactor,
        repetitions: initialReview.repetitions,
      }))

      const { error: historyError } = await supabase
        .from('review_history')
        .insert(reviewHistories)

      if (historyError) {
        console.error('Error creating review history:', historyError)
        // エラーでも継続（質問は作成済み）
      }
    }

    return NextResponse.json({
      success: true,
      session_id: session.id,
      project_id: project!.id,
      questions_count: data.review_questions?.length || 0,
    })
  } catch (error) {
    console.error('Error in /api/import:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
