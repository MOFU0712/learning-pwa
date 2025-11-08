'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [todayReviewCount, setTodayReviewCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
    fetchTodayReviewCount()
  }, [])

  const checkUser = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)
  }

  const fetchTodayReviewCount = async () => {
    try {
      const response = await fetch('/api/reviews/today')
      const data = await response.json()

      if (response.ok) {
        setTodayReviewCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching today review count:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">ダッシュボード</h1>
            <p className="text-muted-foreground mt-1">
              {user?.email ? `ようこそ、${user.email}さん` : 'ようこそ'}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>

        {/* 今日の復習カード */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle>今日の復習</CardTitle>
              <CardDescription>復習が必要な質問数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {todayReviewCount}問
              </div>
              {todayReviewCount > 0 ? (
                <Button
                  className="w-full mt-4"
                  onClick={() => router.push('/review')}
                >
                  復習を始める
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">
                  今日の復習項目はありません
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>学習時間</CardTitle>
              <CardDescription>今週の合計</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0時間</div>
              <p className="text-sm text-muted-foreground mt-4">
                データがありません
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>学習ストリーク</CardTitle>
              <CardDescription>連続学習日数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">0日</div>
              <p className="text-sm text-muted-foreground mt-4">
                データがありません
              </p>
            </CardContent>
          </Card>
        </div>

        {/* クイックアクション */}
        <Card>
          <CardHeader>
            <CardTitle>クイックアクション</CardTitle>
            <CardDescription>よく使う機能</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push('/review')}
            >
              <span className="text-2xl">📚</span>
              <span>復習を始める</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push('/sessions/new')}
            >
              <span className="text-2xl">➕</span>
              <span>学習記録を追加</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push('/projects')}
            >
              <span className="text-2xl">📖</span>
              <span>プロジェクト一覧</span>
            </Button>
          </CardContent>
        </Card>

        {/* 最近の活動 */}
        <Card>
          <CardHeader>
            <CardTitle>最近の学習記録</CardTitle>
            <CardDescription>直近の活動履歴</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              まだ学習記録がありません。JSONファイルを取り込んで始めましょう。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
