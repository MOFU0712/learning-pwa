'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ReviewQuestionWithHistory } from '@/types/database'

export default function ReviewPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<ReviewQuestionWithHistory[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    checkAuthAndFetchReviews()
  }, [])

  const checkAuthAndFetchReviews = async () => {
    // 認証チェック
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // 復習データを取得
    fetchTodayReviews()
  }

  const fetchTodayReviews = async () => {
    try {
      const response = await fetch('/api/reviews/today')
      const data = await response.json()

      if (response.ok) {
        setQuestions(data.questions || [])
        if (data.count === 0) {
          setCompleted(true)
        }
      } else {
        console.error('Failed to fetch reviews:', data.error)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRating = async (rating: number) => {
    if (submitting) return

    setSubmitting(true)

    try {
      const currentQuestion = questions[currentIndex]
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          self_rating: rating,
          reviewed_at: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        // 次の質問へ
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1)
          setShowAnswer(false)
        } else {
          setCompleted(true)
        }
      } else {
        const data = await response.json()
        console.error('Failed to submit review:', data.error)
      }
    } catch (error) {
      console.error('Error submitting review:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (completed || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {questions.length === 0 ? '今日の復習はありません' : 'お疲れ様でした！'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {questions.length > 0 && (
              <div className="text-4xl">🎉</div>
            )}
            <p className="text-muted-foreground">
              {questions.length === 0
                ? '今日復習する項目はありません。新しい学習記録を追加するか、明日また来てください。'
                : `今日の復習を${questions.length}問完了しました！`}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/dashboard')}>
              ダッシュボードに戻る
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* プログレスバー */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>進捗</span>
            <span>
              {currentIndex + 1} / {questions.length}問
            </span>
          </div>
          <Progress value={progress} />
        </div>

        {/* 質問カード */}
        <Card>
          <CardHeader>
            <CardTitle>質問</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg">{currentQuestion.question}</p>

            {!showAnswer ? (
              <div className="text-center pt-4">
                <Button onClick={() => setShowAnswer(true)} size="lg">
                  答えを見る
                </Button>
              </div>
            ) : (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <h3 className="font-semibold mb-2">答え</h3>
                  <p className="text-muted-foreground">{currentQuestion.answer}</p>
                </div>

                {currentQuestion.explanation && (
                  <div>
                    <h3 className="font-semibold mb-2">解説</h3>
                    <p className="text-muted-foreground">{currentQuestion.explanation}</p>
                  </div>
                )}

                {currentQuestion.why_important && (
                  <div>
                    <h3 className="font-semibold mb-2">なぜ重要か</h3>
                    <p className="text-muted-foreground">{currentQuestion.why_important}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-center">自己評価を選択してください</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { rating: 1, label: '全く覚えていない', color: 'bg-red-500 hover:bg-red-600' },
                      { rating: 2, label: '少し覚えている', color: 'bg-orange-500 hover:bg-orange-600' },
                      { rating: 3, label: 'まあまあ', color: 'bg-yellow-500 hover:bg-yellow-600' },
                      { rating: 4, label: 'よく覚えている', color: 'bg-blue-500 hover:bg-blue-600' },
                      { rating: 5, label: '完璧', color: 'bg-green-500 hover:bg-green-600' },
                    ].map(({ rating, label, color }) => (
                      <button
                        key={rating}
                        onClick={() => handleRating(rating)}
                        disabled={submitting}
                        className={`${color} text-white p-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center space-y-1`}
                      >
                        <span className="text-2xl font-bold">{rating}</span>
                        <span className="text-xs text-center">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 関連概念 */}
        {currentQuestion.related_concepts && currentQuestion.related_concepts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">関連概念</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {currentQuestion.related_concepts.map((concept, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
