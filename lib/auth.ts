import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * サーバーコンポーネントで認証チェックを行う
 * 未認証の場合はログインページにリダイレクト
 */
export async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * 既にログイン済みの場合はダッシュボードにリダイレクト
 * （ログイン/サインアップページで使用）
 */
export async function redirectIfAuthenticated() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }
}
