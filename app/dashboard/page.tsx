'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Book } from '@/types/database'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [todayReviewCount, setTodayReviewCount] = useState<number>(0)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
    fetchTodayReviewCount()
    fetchBooks()
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

  const fetchBooks = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching books:', error)
        return
      }

      setBooks(data || [])
    } catch (error) {
      console.error('Error fetching books:', error)
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
          <CardContent className="grid gap-4 md:grid-cols-4">
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
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push('/settings/prompts')}
            >
              <span className="text-2xl">⚙️</span>
              <span>プロンプト設定</span>
            </Button>
          </CardContent>
        </Card>

        {/* 書籍一覧 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>書籍一覧</CardTitle>
              <CardDescription>AI チューターで学習中の書籍</CardDescription>
            </div>
            <Button onClick={() => router.push('/books/new')}>
              ➕ 新しい書籍を追加
            </Button>
          </CardHeader>
          <CardContent>
            {books.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-4">
                  まだ書籍がありません。PDFをアップロードして学習を始めましょう。
                </p>
                <Button onClick={() => router.push('/books/new')}>
                  書籍を追加する
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {books.map((book) => (
                  <Card
                    key={book.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => router.push(`/books/${book.id}/chat`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">
                            {book.title}
                          </CardTitle>
                          {book.author && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {book.author}
                            </p>
                          )}
                        </div>
                        <div
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            book.processing_status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : book.processing_status === 'processing'
                              ? 'bg-blue-100 text-blue-700'
                              : book.processing_status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {book.processing_status === 'completed'
                            ? '完了'
                            : book.processing_status === 'processing'
                            ? '処理中'
                            : book.processing_status === 'failed'
                            ? '失敗'
                            : '待機中'}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {book.total_chapters && (
                          <p>📚 {book.total_chapters} 章</p>
                        )}
                        {book.total_pages && <p>📄 {book.total_pages} ページ</p>}
                        <p className="text-xs">
                          追加日:{' '}
                          {new Date(book.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
