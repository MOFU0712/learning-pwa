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

    // PDF解析プロンプト
    const analysisPrompt = `
あなたはPDF学習教材の構造解析の専門家です。以下のPDFを解析し、学習に最適な形で章とセクションに分割してください。

【解析要件】
1. PDFから最初の3章のみを抽出（トークン制限のため）
   - 章番号と章タイトルを識別
   - 各章の概要（summary）を100文字程度で簡潔に作成

2. 各章を最大3セクションに分割
   - 1セクション = 5-10分で学習できる単位（800-1500文字程度）
   - セクションごとに簡潔なタイトルをつける
   - セクションの本文（content）を抽出（重要な部分のみ）
   - 推定学習時間（分）を計算

3. **必ず完全なJSONを出力してください**
   - 途中で切れないように注意
   - 最後の } まで必ず出力
   - JSON以外の説明文は一切出力しない

出力JSONフォーマット：
{
  "title": "書籍タイトル",
  "author": "著者名",
  "totalPages": ページ数,
  "chapters": [
    {
      "number": 1,
      "title": "章タイトル",
      "summary": "100文字以内の概要",
      "sections": [
        {
          "number": 1,
          "title": "セクションタイトル",
          "content": "本文（800-1500文字）",
          "estimatedMinutes": 7
        }
      ]
    }
  ]
}

**重要**: JSONを途中で切らずに、必ず最後まで完成させてください。`;

    console.log('Starting PDF analysis with Gemini...');

    // Gemini Flash 2.0でPDF解析
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 8192, // 出力トークン数を増やす
        temperature: 0.1, // より決定的な出力
        responseMimeType: 'application/json', // JSON出力を指定
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: analysisPrompt },
    ]);

    const responseText = result.response.text();
    console.log('Gemini response received, parsing JSON...');
    console.log('Response preview:', responseText.substring(0, 500));

    // JSONをパース（```json ... ```をトリム）
    let jsonText = responseText.trim();

    // コードブロックを削除
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.substring(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.substring(3);
    }

    if (jsonText.endsWith('```')) {
      jsonText = jsonText.substring(0, jsonText.length - 3);
    }

    jsonText = jsonText.trim();

    // JSONの開始と終了を探す
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('Invalid JSON format - no braces found');
      console.error('Response text:', responseText);
      throw new Error('Invalid JSON format in Gemini response');
    }

    jsonText = jsonText.substring(jsonStart, jsonEnd + 1);

    let pdfData: PDFProcessingResult;
    try {
      pdfData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonText.substring(0, 1000));
      throw new Error('Failed to parse Gemini response as JSON');
    }

    console.log(
      `Parsed PDF: ${pdfData.chapters.length} chapters, ${pdfData.chapters.reduce((sum, ch) => sum + ch.sections.length, 0)} sections`
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
