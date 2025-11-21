'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Book } from '@/types/database'

interface RecentSession {
  id: string
  book_id: string
  book_title: string
  progress_status: string | null
  current_topic: string | null
  created_at: string
  updated_at: string
}

interface LearningStats {
  totalTopics: number
  learningDays: number
  totalSessions: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [todayReviewCount, setTodayReviewCount] = useState<number>(0)
  const [books, setBooks] = useState<Book[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [stats, setStats] = useState<LearningStats>({ totalTopics: 0, learningDays: 0, totalSessions: 0 })
  const [loading, setLoading] = useState(true)
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    fetchTodayReviewCount()
    fetchBooks()
    fetchRecentSessions()
    fetchLearningStats()
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

  const fetchRecentSessions = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // 最近のチャットセッションを取得（書籍情報も含む）
      // updated_at がない場合は created_at でフォールバック
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          book_id,
          progress_status,
          current_topic,
          created_at,
          books (title)
        `)
        .eq('user_id', user.id)
        .not('book_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error fetching recent sessions:', error)
        return
      }

      const sessions: RecentSession[] = (data || []).map((s: any) => ({
        id: s.id,
        book_id: s.book_id,
        book_title: s.books?.title || '不明な書籍',
        progress_status: s.progress_status,
        current_topic: s.current_topic,
        created_at: s.created_at,
        updated_at: s.created_at, // フォールバック
      }))

      setRecentSessions(sessions)
    } catch (error) {
      console.error('Error fetching recent sessions:', error)
    }
  }

  const fetchLearningStats = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // 完了したトピック数を計算（progress_statusから抽出）
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('progress_status, created_at')
        .eq('user_id', user.id)

      let totalTopics = 0
      const learningDates = new Set<string>()

      sessions?.forEach((s) => {
        // progress_status が "3/10" のような形式の場合、最初の数字を取得
        if (s.progress_status) {
          const match = s.progress_status.match(/^(\d+)/)
          if (match) {
            totalTopics = Math.max(totalTopics, parseInt(match[1], 10))
          }
        }
        // 学習した日をカウント
        if (s.created_at) {
          learningDates.add(s.created_at.split('T')[0])
        }
      })

      // セッション総数
      const totalSessions = sessions?.length || 0

      setStats({
        totalTopics,
        learningDays: learningDates.size,
        totalSessions,
      })
    } catch (error) {
      console.error('Error fetching learning stats:', error)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleDeleteBook = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation() // カードのクリックイベントを停止

    if (!confirm('この書籍を削除してもよろしいですか？\n関連するチャット履歴や復習問題も全て削除されます。')) {
      return
    }

    setDeletingBookId(bookId)
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // 書籍一覧を更新
        setBooks(books.filter((book) => book.id !== bookId))
        // 最近のセッションも更新
        setRecentSessions(recentSessions.filter((session) => session.book_id !== bookId))
      } else {
        const data = await response.json()
        alert(`削除に失敗しました: ${data.error || 'エラーが発生しました'}`)
      }
    } catch (error) {
      console.error('Error deleting book:', error)
      alert('削除中にエラーが発生しました')
    } finally {
      setDeletingBookId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8 flex flex-col">
        {/* ヘッダー */}
        <div className="flex justify-between items-center gap-2 order-1">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-3xl font-bold">ダッシュボード</h1>
            <p className="text-muted-foreground text-xs sm:text-base mt-1 truncate">
              {user?.email ? `ようこそ、${user.email}さん` : 'ようこそ'}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} size="sm" className="shrink-0">
            ログアウト
          </Button>
        </div>

        {/* 今日の復習カード - モバイルでは書籍一覧の後に表示 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 order-3 sm:order-2">
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
              <CardTitle>学習トピック</CardTitle>
              <CardDescription>これまでに学習したトピック</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.totalTopics}個</div>
              <p className="text-sm text-muted-foreground mt-4">
                {stats.totalSessions}回のセッション
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>学習日数</CardTitle>
              <CardDescription>学習した日数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.learningDays}日</div>
              <p className="text-sm text-muted-foreground mt-4">
                {stats.learningDays > 0 ? '継続して学習しましょう！' : '今日から始めましょう！'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 書籍一覧 - モバイルでは最初に表示 */}
        <Card id="books-section" className="order-2 sm:order-3">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg sm:text-xl">書籍一覧</CardTitle>
              <CardDescription className="text-xs sm:text-sm">AI チューターで学習中の書籍</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => router.push('/books/new')} size="sm" className="flex-1 sm:flex-none">
                ➕ 書籍を追加
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/settings/prompts')}
                className="flex-1 sm:flex-none"
              >
                ⚙️ 設定
              </Button>
            </div>
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
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full mt-4"
                        onClick={(e) => handleDeleteBook(book.id, e)}
                        disabled={deletingBookId === book.id}
                      >
                        {deletingBookId === book.id ? '削除中...' : '削除'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近の活動 */}
        <Card className="order-4">
          <CardHeader>
            <CardTitle>最近の学習記録</CardTitle>
            <CardDescription>直近の活動履歴</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                まだ学習記録がありません。書籍を追加して学習を始めましょう。
              </p>
            ) : (
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/books/${session.book_id}/chat?sessionId=${session.id}`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{session.book_title}</h4>
                      {session.current_topic && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {session.current_topic}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(session.updated_at).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {session.progress_status && (
                      <div className="ml-4 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                        {session.progress_status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
