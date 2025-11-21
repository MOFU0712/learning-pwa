'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChapterInfo {
  number: number;
  title: string;
}

export default function NewBookPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム状態
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // 処理進捗状態
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processedChapters, setProcessedChapters] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const fileNameRef = useRef<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('PDFファイルを選択してください');
        return;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB制限
        setError('ファイルサイズは50MB以下にしてください');
        return;
      }
      setPdfFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    if (!pdfFile) {
      setError('PDFファイルを選択してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Supabaseクライアント取得
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // ユーザー認証確認
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('ログインが必要です');
      }

      setProcessingStatus('PDFをアップロード中...');

      // 1. PDFをSupabase Storageにアップロード
      const sanitizedFileName = pdfFile.name
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_');
      const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
      fileNameRef.current = fileName;

      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, pdfFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`アップロード失敗: ${uploadError.message}`);
      }

      // 2. 公開URLを取得
      const {
        data: { publicUrl },
      } = supabase.storage.from('pdfs').getPublicUrl(fileName);

      setProcessingStatus('目次を解析中...');

      // 3. PDF処理API（目次抽出＋Book作成）
      const response = await fetch('/api/books/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          author,
          pdfUrl: publicUrl,
          fileName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || '処理に失敗しました');
      }

      const result = await response.json();
      const { bookId, chapters } = result as { bookId: string; chapters: ChapterInfo[] };

      setTotalChapters(chapters.length);
      setProcessedChapters(0);

      // 4. 章ごとに処理（順番に実行）
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        setProcessingStatus(`第${chapter.number}章を処理中... (${i + 1}/${chapters.length})`);

        try {
          const chapterResponse = await fetch('/api/books/process-chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookId,
              chapterNumber: chapter.number,
              chapterTitle: chapter.title,
              fileName,
            }),
          });

          if (!chapterResponse.ok) {
            console.error(`Chapter ${chapter.number} failed`);
            // エラーでも続行
          }

          setProcessedChapters(i + 1);
        } catch (chapterError) {
          console.error(`Chapter ${chapter.number} error:`, chapterError);
          // エラーでも続行
        }
      }

      setProcessingStatus('処理完了！リダイレクト中...');

      // 処理完了後、チャットページへリダイレクト
      router.push(`/books/${bookId}/chat`);
    } catch (err) {
      console.error('Book upload error:', err);
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2 mb-4"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">新しい書籍を追加</h1>
          <p className="text-gray-600 mt-2">
            PDFファイルをアップロードして、AIチューターと一緒に学習を始めましょう
          </p>
        </div>

        {/* フォーム */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* タイトル */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                書籍タイトル <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例: Clean Architecture"
                disabled={isLoading}
                required
              />
            </div>

            {/* 著者 */}
            <div>
              <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
                著者名
              </label>
              <input
                id="author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例: Robert C. Martin"
                disabled={isLoading}
              />
            </div>

            {/* PDFファイル */}
            <div>
              <label htmlFor="pdf" className="block text-sm font-medium text-gray-700 mb-2">
                PDFファイル <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-500 transition-colors">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="pdf"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                    >
                      <span>ファイルを選択</span>
                      <input
                        id="pdf"
                        name="pdf"
                        type="file"
                        accept=".pdf"
                        className="sr-only"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        required
                      />
                    </label>
                    <p className="pl-1">またはドラッグ&ドロップ</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF形式、最大50MB</p>
                  {pdfFile && (
                    <p className="text-sm text-indigo-600 font-medium mt-2">
                      選択中: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            {/* 処理中メッセージ */}
            {isLoading && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">{processingStatus || 'PDFを処理中...'}</p>
                    {totalChapters > 0 && (
                      <>
                        <p className="text-sm mt-1">
                          進捗: {processedChapters} / {totalChapters} 章
                        </p>
                        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(processedChapters / totalChapters) * 100}%` }}
                          ></div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 送信ボタン */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading || !title.trim() || !pdfFile}
                className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {isLoading ? '処理中...' : 'アップロード開始'}
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-center"
              >
                キャンセル
              </Link>
            </div>
          </form>

          {/* 説明 */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">処理について</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex gap-2">
                <span>•</span>
                <span>Gemini AIがPDFを解析し、自動的に章とセクションに分割します</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>各セクションにembeddingを生成し、セマンティック検索を可能にします</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>処理完了後、AIチューターとの対話学習を開始できます</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
