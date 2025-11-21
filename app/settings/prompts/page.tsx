'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function PromptsSettingsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // フォーム状態
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/prompts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch prompts');
      }

      setPrompts(data.prompts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // デフォルトプロンプトを初期化
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
        // 新規作成
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
        // 更新
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2 mb-4"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">システムプロンプト設定</h1>
          <p className="text-gray-600 mt-2">
            AIチューターの振る舞いをカスタマイズできます。{'{context}'} プレースホルダーに書籍のコンテキストが挿入されます。
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* 編集フォーム */}
        {(isCreating || editingPrompt) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
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
                  rows={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* プロンプト一覧 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">保存済みプロンプト</h2>
            <div className="flex gap-2">
              {prompts.length === 0 && (
                <button
                  onClick={initializeDefaultPrompt}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                >
                  デフォルトを初期化
                </button>
              )}
              <button
                onClick={startCreating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
              >
                新規作成
              </button>
            </div>
          </div>

          {prompts.length === 0 ? (
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
                  className={`border rounded-lg p-4 ${
                    prompt.is_default ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {prompt.name}
                        {prompt.is_default && (
                          <span className="ml-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded">
                            デフォルト
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        更新日: {new Date(prompt.updated_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(prompt)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deletePrompt(prompt.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {prompt.content.substring(0, 500)}
                      {prompt.content.length > 500 ? '...' : ''}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ヒント */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">ヒント</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>・プロンプト内に {'{context}'} と書くと、関連するセクションの内容が挿入されます</li>
            <li>・「デフォルト」に設定したプロンプトがチャットで使用されます</li>
            <li>・複数のプロンプトを保存して、用途に応じて切り替えられます</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
