'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function NewSessionPage() {
  const router = useRouter()
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const checkAuth = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      // JSONをパース
      const data = JSON.parse(jsonInput)

      // APIにPOST
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      })

      const result = await response.json()

      if (response.ok) {
        setSuccess(
          `取り込み成功！ ${result.questions_count}個の質問を追加しました。`
        )
        setJsonInput('')

        // 3秒後にダッシュボードに戻る
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      } else {
        setError(result.error || '取り込みに失敗しました')
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSONの形式が正しくありません')
      } else {
        setError('取り込み中にエラーが発生しました')
      }
    } finally {
      setLoading(false)
    }
  }

  const exampleJson = `{
  "date": "2025-11-06",
  "project": "python-basics",
  "title": "Python入門",
  "author": "山田太郎",
  "chapter": 3,
  "chapter_title": "制御構造",
  "topic": "if文と条件分岐",
  "duration_minutes": 40,
  "understanding_level": 4,
  "key_concepts": [
    "if-elif-else文の構造",
    "比較演算子",
    "論理演算子"
  ],
  "review_questions": [
    {
      "question": "if-elif-else文で条件を書く順序はなぜ重要ですか？",
      "answer": "上から順に評価され、最初にTrueになった条件のブロックだけが実行されるため",
      "explanation": "Pythonのif-elif-else文は、上から順に条件を評価し、最初にTrueとなった条件のブロックのみを実行します。",
      "why_important": "条件の順序を間違えると、意図しない動作をする可能性があります。",
      "related_concepts": ["条件式の評価", "短絡評価"],
      "difficulty_level": 3
    }
  ]
}`

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">学習記録の取り込み</h1>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            戻る
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>JSON形式で学習記録を取り込む</CardTitle>
            <CardDescription>
              学習記録をJSON形式で入力してください。プロジェクト、セッション、復習質問が自動的に登録されます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                {success}
              </div>
            )}

            <form onSubmit={handleImport} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json-input">JSON入力</Label>
                <textarea
                  id="json-input"
                  className="w-full min-h-[400px] p-4 rounded-md border border-input bg-background font-mono text-sm"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="JSONを入力してください..."
                  required
                />
              </div>

              <Button type="submit" disabled={loading || !jsonInput.trim()}>
                {loading ? '取り込み中...' : '取り込む'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>入力例</CardTitle>
            <CardDescription>以下の形式でJSONを入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
              {exampleJson}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
