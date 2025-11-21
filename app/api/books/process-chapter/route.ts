import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbeddings, estimateTokenCount } from '@/lib/embeddings';

// Route Segment Config
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Gemini APIクライアント
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // JSONボディを取得
    const body = await request.json();
    const { bookId, chapterNumber, chapterTitle, fileName } = body;

    if (!bookId || !chapterNumber || !chapterTitle || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`Processing chapter ${chapterNumber}: ${chapterTitle}`);

    // Book所有者確認
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('user_id', user.id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Supabase StorageからPDFをダウンロード
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(fileName);

    if (downloadError || !pdfBlob) {
      throw new Error('Failed to download PDF');
    }

    // PDFをBase64に変換
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    // 章を処理
    const chapterPrompt = `
以下のPDFから「第${chapterNumber}章: ${chapterTitle}」の内容を抽出し、セクションに分割してください。

出力JSON形式：
{
  "number": ${chapterNumber},
  "title": "${chapterTitle}",
  "summary": "この章の概要（100文字以内）",
  "sections": [
    {
      "number": "1.1",
      "title": "セクションタイトル",
      "content": "セクションの本文（重要な内容を1000文字程度で）",
      "estimatedMinutes": 5
    }
  ]
}

- セクションは最大5つまで
- 重要な内容を優先
- JSON以外は出力しない`;

    const chapterModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const chapterResult = await chapterModel.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: chapterPrompt },
    ]);

    const chapterText = chapterResult.response.text();
    const chapterData = JSON.parse(chapterText);

    console.log(`  → Extracted ${chapterData.sections?.length || 0} sections`);

    // Chapterレコード作成
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .insert({
        book_id: bookId,
        chapter_number: chapterData.number || chapterNumber,
        title: chapterData.title || chapterTitle,
        summary: chapterData.summary || null,
      })
      .select()
      .single();

    if (chapterError || !chapter) {
      console.error('Chapter creation error:', chapterError);
      throw new Error('Failed to create chapter record');
    }

    // Sectionsを処理
    if (chapterData.sections && chapterData.sections.length > 0) {
      const sectionContents = chapterData.sections.map((s: any) => s.content || '');

      // Embeddings一括生成
      console.log(`  Generating embeddings for ${sectionContents.length} sections...`);
      const embeddings = await generateEmbeddings(sectionContents);

      // Sectionsレコード作成
      for (let i = 0; i < chapterData.sections.length; i++) {
        const sectionData = chapterData.sections[i];
        const embedding = embeddings[i];
        const sectionNumber = String(sectionData.number || i + 1);

        const { error: sectionError } = await supabase.from('sections').insert({
          chapter_id: chapter.id,
          section_number: sectionNumber,
          title: sectionData.title || `セクション ${i + 1}`,
          content: sectionData.content || '',
          content_vector: embedding,
          token_count: estimateTokenCount(sectionData.content || ''),
          estimated_minutes: sectionData.estimatedMinutes || 5,
        });

        if (sectionError) {
          console.error('Section creation error:', sectionError);
        }
      }
    }

    // 処理済み章数を更新
    const { error: updateError } = await supabase
      .from('books')
      .update({
        processed_chapters: (book.processed_chapters || 0) + 1,
        processing_status:
          (book.processed_chapters || 0) + 1 >= book.total_chapters
            ? 'completed'
            : 'processing',
      })
      .eq('id', bookId);

    if (updateError) {
      console.error('Book update error:', updateError);
    }

    const isCompleted = (book.processed_chapters || 0) + 1 >= book.total_chapters;

    return NextResponse.json({
      success: true,
      chapterNumber,
      sectionsCreated: chapterData.sections?.length || 0,
      processedChapters: (book.processed_chapters || 0) + 1,
      totalChapters: book.total_chapters,
      isCompleted,
    });
  } catch (error) {
    console.error('Chapter processing error:', error);
    return NextResponse.json(
      {
        error: 'Chapter processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
