'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Book } from '@/types/database';

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

type TabType = 'prompts' | 'books';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('prompts');

  // プロンプト関連
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  // 書籍関連
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  // エラー
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    try {
      setIsLoadingPrompts(true);
      const response = await fetch('/api/prompts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch prompts');
      }

      setPrompts(data.prompts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    try {
      setIsLoadingBooks(true);
      const response = await fetch('/api/books');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch books');
      }

      setBooks(data.books || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
    fetchBooks();
  }, [fetchPrompts, fetchBooks]);

  // プロンプト操作
  const initializeDefaultPrompt = async () => {
    try {
      const response = await fetch('/api/prompts/default');
      if (response.ok) {
        await fetchPrompts();
      }
    } catch (err) {
      console.error('Failed to initialize default prompt:', err);
    }
  };

  const startEditing = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setFormName(prompt.name);
    setFormContent(prompt.content);
    setFormIsDefault(prompt.is_default);
    setIsCreating(false);
  };

  const startCreating = () => {
    setEditingPrompt(null);
    setFormName('');
    setFormContent('');
    setFormIsDefault(false);
    setIsCreating(true);
  };

  const cancelEdit = () => {
    setEditingPrompt(null);
    setIsCreating(false);
    setFormName('');
    setFormContent('');
    setFormIsDefault(false);
  };

  const savePrompt = async () => {
    if (!formName.trim() || !formContent.trim()) {
      setError('名前と内容を入力してください');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isCreating) {
        const response = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            content: formContent,
            is_default: formIsDefault,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create prompt');
        }
      } else if (editingPrompt) {
        const response = await fetch(`/api/prompts/${editingPrompt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            content: formContent,
            is_default: formIsDefault,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update prompt');
        }
      }

      await fetchPrompts();
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrompt = async (id: string) => {
    if (!confirm('このプロンプトを削除しますか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete prompt');
      }

      await fetchPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  // 書籍操作
  const deleteBook = async (bookId: string) => {
    if (!confirm('この書籍を削除しますか？\n関連するチャット履歴や復習問題も全て削除されます。')) {
      return;
    }

    setDeletingBookId(bookId);
    setError(null);

    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete book');
      }

      setBooks(books.filter((book) => book.id !== bookId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setDeletingBookId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2 mb-4 text-sm sm:text-base"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">設定</h1>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 text-sm sm:text-base font-medium border-b-2 transition-colors ${
              activeTab === 'prompts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            プロンプト設定
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`px-4 py-2 text-sm sm:text-base font-medium border-b-2 transition-colors ${
              activeTab === 'books'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            書籍管理
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-800 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* プロンプト設定タブ */}
        {activeTab === 'prompts' && (
          <div>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">
              AIチューターの振る舞いをカスタマイズできます。{'{context}'} プレースホルダーに書籍のコンテキストが挿入されます。
            </p>

            {/* 編集フォーム */}
            {(isCreating || editingPrompt) && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">
                  {isCreating ? '新規プロンプト作成' : 'プロンプト編集'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      プロンプト名
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="例: 家庭教師AI (カスタム)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      プロンプト内容
                    </label>
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={15}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm"
                      placeholder="システムプロンプトを入力してください..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {'{context}'} と書くと、その位置に書籍のコンテキストが挿入されます
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isDefault" className="text-sm text-gray-700">
                      デフォルトとして使用
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={savePrompt}
                      disabled={isSaving}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 text-sm"
                    >
                      {isSaving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* プロンプト一覧 */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">保存済みプロンプト</h2>
                <div className="flex gap-2">
                  {prompts.length === 0 && (
                    <button
                      onClick={initializeDefaultPrompt}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs sm:text-sm"
                    >
                      デフォルトを初期化
                    </button>
                  )}
                  <button
                    onClick={startCreating}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs sm:text-sm"
                  >
                    新規作成
                  </button>
                </div>
              </div>

              {isLoadingPrompts ? (
                <div className="text-center py-8 text-gray-500">読み込み中...</div>
              ) : prompts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>まだプロンプトが登録されていません。</p>
                  <p className="text-sm mt-2">
                    「デフォルトを初期化」ボタンで家庭教師AIプロンプトを追加できます。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className={`border rounded-lg p-3 sm:p-4 ${
                        prompt.is_default ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm sm:text-base">
                            {prompt.name}
                            {prompt.is_default && (
                              <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded">
                                デフォルト
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            更新日: {new Date(prompt.updated_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(prompt)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs sm:text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => deletePrompt(prompt.id)}
                            className="text-red-600 hover:text-red-800 text-xs sm:text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-24">
                          {prompt.content.substring(0, 300)}
                          {prompt.content.length > 300 ? '...' : ''}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 書籍管理タブ */}
        {activeTab === 'books' && (
          <div>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">
              登録済みの書籍を管理できます。書籍を削除すると、関連するチャット履歴や復習問題も削除されます。
            </p>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">登録済み書籍</h2>

              {isLoadingBooks ? (
                <div className="text-center py-8 text-gray-500">読み込み中...</div>
              ) : books.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>まだ書籍が登録されていません。</p>
                  <Link
                    href="/books/new"
                    className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                  >
                    書籍を追加する
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                          {book.title}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                          {book.author && <span>{book.author}</span>}
                          {book.total_chapters && <span>📚 {book.total_chapters}章</span>}
                          <span
                            className={`px-1.5 py-0.5 rounded ${
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
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteBook(book.id)}
                        disabled={deletingBookId === book.id}
                        className="ml-4 px-3 py-1.5 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {deletingBookId === book.id ? '削除中...' : '削除'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ヒント */}
        {activeTab === 'prompts' && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-800 mb-2 text-sm">ヒント</h3>
            <ul className="text-xs sm:text-sm text-yellow-700 space-y-1">
              <li>・プロンプト内に {'{context}'} と書くと、関連するセクションの内容が挿入されます</li>
              <li>・「デフォルト」に設定したプロンプトがチャットで使用されます</li>
              <li>・複数のプロンプトを保存して、用途に応じて切り替えられます</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
