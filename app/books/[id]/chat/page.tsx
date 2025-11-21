'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Book, Chapter, ChatMessage as ChatMessageType } from '@/types/database';

interface ChatPageState {
  book: Book | null;
  chapters: Chapter[];
  selectedChapterId: string | null;
  messages: ChatMessageType[];
  isLoading: boolean;
  error: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [state, setState] = useState<ChatPageState>({
    book: null,
    chapters: [],
    selectedChapterId: null,
    messages: [],
    isLoading: true,
    error: null,
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期データ取得
  useEffect(() => {
    fetchBookData();
  }, [bookId]);

  // メッセージ自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const fetchBookData = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch book data');
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        book: data.book,
        chapters: data.chapters,
        messages: data.messages || [],
        isLoading: false,
      }));

      // 既存のセッションIDを設定
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Error fetching book data:', error);
      setState((prev) => ({
        ...prev,
        error: 'データの取得に失敗しました',
        isLoading: false,
      }));
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // ユーザーメッセージを即座に表示
    const tempUserMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      session_id: sessionId || '',
      role: 'user',
      content: userMessage,
      sections_used: null,
      token_count: null,
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, tempUserMessage],
    }));

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          chapterId: state.selectedChapterId,
          sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      // AIレスポンス用の空メッセージを追加
      const tempAiMessage: ChatMessageType = {
        id: `temp-ai-${Date.now()}`,
        session_id: sessionId || '',
        role: 'assistant',
        content: '',
        sections_used: null,
        token_count: null,
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, tempAiMessage],
      }));

      // ストリーミングレスポンスを読み取る
      let accumulatedContent = '';
      let newSessionId = sessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.sessionId && !newSessionId) {
                newSessionId = parsed.sessionId;
                setSessionId(parsed.sessionId);
              }

              if (parsed.content) {
                accumulatedContent += parsed.content;
                setState((prev) => ({
                  ...prev,
                  messages: prev.messages.map((msg, idx) =>
                    idx === prev.messages.length - 1
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ),
                }));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setState((prev) => ({
        ...prev,
        error: 'メッセージの送信に失敗しました',
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    if (!sessionId || isClearingHistory) return;

    if (!confirm('チャット履歴をクリアしますか？この操作は取り消せません。')) {
      return;
    }

    setIsClearingHistory(true);
    try {
      const response = await fetch('/api/chat/clear-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to clear history');
      }

      // UIをリセット
      setSessionId(null);
      setState((prev) => ({
        ...prev,
        messages: [],
      }));
    } catch (error) {
      console.error('Error clearing history:', error);
      alert('履歴のクリアに失敗しました');
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId || isEndingSession) return;

    setIsEndingSession(true);
    try {
      const response = await fetch('/api/chat/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          bookId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end session');
      }

      // 成功時: モーダルを閉じて結果を表示
      setShowEndSessionModal(false);
      alert(`セッションを終了しました。\n${data.questionsCount}問の復習問題を生成しました。\n\n復習ページで確認できます。`);

      // 新しいセッションを開始するためにリセット
      setSessionId(null);
      setState((prev) => ({
        ...prev,
        messages: [],
      }));
    } catch (error) {
      console.error('Error ending session:', error);
      alert(error instanceof Error ? error.message : 'セッションの終了に失敗しました');
    } finally {
      setIsEndingSession(false);
    }
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (state.error || !state.book) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{state.error || '書籍が見つかりません'}</p>
          <Link href="/dashboard" className="text-indigo-600 hover:underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* 書籍情報 */}
          <div className="min-w-0 flex-1">
            <Link href="/dashboard" className="text-indigo-600 hover:underline text-xs sm:text-sm mb-1 block">
              ← ダッシュボード
            </Link>
            <h1 className="text-base sm:text-2xl font-bold text-gray-900 truncate">{state.book.title}</h1>
            {state.book.author && (
              <p className="text-xs sm:text-sm text-gray-600 truncate">著者: {state.book.author}</p>
            )}
          </div>

          {/* 章選択とアクションボタン */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <select
              value={state.selectedChapterId || ''}
              onChange={(e) =>
                setState((prev) => ({ ...prev, selectedChapterId: e.target.value || null }))
              }
              className="flex-1 sm:flex-none min-w-0 px-2 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全体</option>
              {state.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  第{chapter.chapter_number}章: {chapter.title}
                </option>
              ))}
            </select>

            {/* 履歴クリアボタン */}
            {sessionId && state.messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {isClearingHistory ? 'クリア中...' : '履歴クリア'}
              </button>
            )}

            {/* セッション終了ボタン */}
            {sessionId && state.messages.length >= 2 && (
              <button
                onClick={() => setShowEndSessionModal(true)}
                className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-medium whitespace-nowrap"
              >
                学習を終了
              </button>
            )}
          </div>
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
        {state.messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💭</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              AIチューターと学習を始めましょう
            </h2>
            <p className="text-gray-600 mb-6">
              質問を入力すると、書籍の内容を基にAIが回答します
            </p>
            <div className="max-w-md mx-auto text-left bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-2">例えばこんな質問：</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• この章の要点を教えてください</li>
                <li>• 〇〇の概念について詳しく説明してください</li>
                <li>• 実践的な例を挙げて説明してください</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {state.messages.map((message, idx) => (
              <div
                key={message.id || idx}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === 'assistant' && message.content === '' && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="animate-bounce">●</div>
                      <div className="animate-bounce delay-100">●</div>
                      <div className="animate-bounce delay-200">●</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto flex gap-2 sm:gap-4">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力..."
            disabled={isSending}
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isSending}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors h-fit text-sm sm:text-base"
          >
            {isSending ? '...' : '送信'}
          </button>
        </div>
      </div>

      {/* セッション終了確認モーダル */}
      {showEndSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              学習セッションを終了しますか？
            </h3>
            <p className="text-gray-600 mb-6">
              セッションを終了すると、この学習内容から復習問題が自動生成されます。
              生成された問題は復習ページで確認・学習できます。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEndSessionModal(false)}
                disabled={isEndingSession}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleEndSession}
                disabled={isEndingSession}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:bg-gray-300 transition-colors"
              >
                {isEndingSession ? '生成中...' : '終了して復習問題を生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
