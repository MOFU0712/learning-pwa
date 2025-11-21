import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbeddings, estimateTokenCount } from '@/lib/embeddings';
import type { PDFProcessingResult } from '@/types/database';

// Route Segment Config: 最大実行時間とボディサイズ制限
export const maxDuration = 300; // 5分（Vercel Pro以上で必要）
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
    const { title, author, pdfUrl, fileName } = body;

    if (!title || !pdfUrl) {
      return NextResponse.json(
        { error: 'Title and PDF URL are required' },
        { status: 400 }
      );
    }

    console.log('Downloading PDF from Supabase Storage...', { fileName });

    // Supabase StorageからPDFをダウンロード
    // 注意: サーバー側なのでRLSをバイパスできる
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(fileName);

    if (downloadError) {
      console.error('Download error details:', downloadError);
      throw new Error(`Failed to download PDF: ${downloadError.message}`);
    }

    if (!pdfBlob) {
      throw new Error('PDF blob is null');
    }

    console.log('PDF downloaded successfully, size:', pdfBlob.size);

    // PDFをBase64に変換
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    console.log('Step 1: Extracting table of contents...');

    // Step 1: 目次を抽出して章のリストを取得
    const tocPrompt = `
以下のPDFから目次（Table of Contents）を抽出してください。

出力は以下のJSON形式のみ：
{
  "title": "書籍タイトル",
  "author": "著者名",
  "totalPages": ページ数,
  "chapters": [
    {"number": 1, "title": "章タイトル"},
    {"number": 2, "title": "章タイトル"}
  ]
}

JSON以外は一切出力しないでください。`;

    const tocModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const tocResult = await tocModel.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: tocPrompt },
    ]);

    const tocText = tocResult.response.text();
    console.log('TOC extracted:', tocText.substring(0, 300));

    const tocData = JSON.parse(tocText);
    const bookTitle = tocData.title || title;
    const bookAuthor = tocData.author || author;
    const totalPages = tocData.totalPages || null;
    const chaptersList = tocData.chapters || [];

    console.log(`Found ${chaptersList.length} chapters`);

    // Step 2: 各章を個別に処理
    const processedChapters = [];
    const chapterModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    for (let i = 0; i < Math.min(chaptersList.length, 5); i++) {
      // 最初の5章のみ処理
      const chapter = chaptersList[i];
      console.log(`Processing chapter ${chapter.number}: ${chapter.title}`);

      const chapterPrompt = `
以下のPDFから「第${chapter.number}章: ${chapter.title}」の内容を抽出し、セクションに分割してください。

出力JSON形式：
{
  "number": ${chapter.number},
  "title": "${chapter.title}",
  "summary": "この章の概要（100文字以内）",
  "sections": [
    {
      "number": 1,
      "title": "セクションタイトル",
      "content": "セクションの本文（重要な内容を1000文字程度で）",
      "estimatedMinutes": 推定学習時間
    }
  ]
}

- 最大5セクションまで
- 重要な内容を優先
- JSON以外は出力しない`;

      try {
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
        processedChapters.push(chapterData);
        console.log(`  → Extracted ${chapterData.sections?.length || 0} sections`);
      } catch (error) {
        console.error(`Failed to process chapter ${chapter.number}:`, error);
        // エラーが起きても続行
        processedChapters.push({
          number: chapter.number,
          title: chapter.title,
          summary: '処理に失敗しました',
          sections: [],
        });
      }
    }

    const pdfData: PDFProcessingResult = {
      title: bookTitle,
      author: bookAuthor,
      totalPages: totalPages,
      chapters: processedChapters,
    };

    console.log(
      `Processed ${pdfData.chapters.length} chapters, ${pdfData.chapters.reduce((sum, ch) => sum + ch.sections.length, 0)} sections total`
    );

    // データベースに保存開始
    console.log('Saving to database...');

    // 1. Bookレコード作成
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        user_id: user.id,
        title: pdfData.title || title,
        author: pdfData.author || author || null,
        total_pages: pdfData.totalPages || null,
        total_chapters: pdfData.chapters.length,
        pdf_url: pdfUrl,
        processing_status: 'processing',
      })
      .select()
      .single();

    if (bookError || !book) {
      console.error('Book creation error:', bookError);
      throw new Error('Failed to create book record');
    }

    console.log(`Book created: ${book.id}`);

    // 2. Chapters & Sections作成 + Embeddings生成
    for (const chapterData of pdfData.chapters) {
      // Chapterレコード作成
      const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .insert({
          book_id: book.id,
          chapter_number: chapterData.number,
          title: chapterData.title,
          summary: chapterData.summary,
        })
        .select()
        .single();

      if (chapterError || !chapter) {
        console.error('Chapter creation error:', chapterError);
        continue;
      }

      console.log(
        `  Chapter ${chapter.chapter_number}: ${chapterData.sections.length} sections`
      );

      // Sectionsの本文を収集（一括embedding生成用）
      const sectionContents = chapterData.sections.map((s) => s.content);

      // Embeddings一括生成
      console.log(`  Generating embeddings for ${sectionContents.length} sections...`);
      const embeddings = await generateEmbeddings(sectionContents);

      // Sectionsレコード作成
      for (let i = 0; i < chapterData.sections.length; i++) {
        const sectionData = chapterData.sections[i];
        const embedding = embeddings[i];

        const { error: sectionError } = await supabase.from('sections').insert({
          chapter_id: chapter.id,
          section_number: sectionData.number,
          title: sectionData.title,
          content: sectionData.content,
          content_vector: embedding,
          token_count: estimateTokenCount(sectionData.content),
          estimated_minutes: sectionData.estimatedMinutes,
        });

        if (sectionError) {
          console.error('Section creation error:', sectionError);
        }
      }
    }

    // 3. Bookステータスを完了に更新
    const { error: updateError } = await supabase
      .from('books')
      .update({ processing_status: 'completed' })
      .eq('id', book.id);

    if (updateError) {
      console.error('Book status update error:', updateError);
    }

    console.log('Processing completed successfully!');

    return NextResponse.json({
      success: true,
      bookId: book.id,
      message: 'PDF processing completed',
    });
  } catch (error) {
    console.error('PDF processing error:', error);
    return NextResponse.json(
      {
        error: 'PDF processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
