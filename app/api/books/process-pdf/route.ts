import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const { title, author, pdfUrl, fileName } = body;

    if (!title || !pdfUrl) {
      return NextResponse.json(
        { error: 'Title and PDF URL are required' },
        { status: 400 }
      );
    }

    console.log('Downloading PDF from Supabase Storage...', { fileName });

    // Supabase StorageからPDFをダウンロード
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

    // 目次を抽出して章のリストを取得
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

全ての章を含めてください。JSON以外は一切出力しないでください。`;

    const tocModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 4096,
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
    console.log('TOC extracted:', tocText.substring(0, 500));

    const tocData = JSON.parse(tocText);
    const bookTitle = tocData.title || title;
    const bookAuthor = tocData.author || author;
    const totalPages = tocData.totalPages || null;
    const chaptersList = tocData.chapters || [];

    console.log(`Found ${chaptersList.length} chapters`);

    // Bookレコード作成（processing状態）
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        user_id: user.id,
        title: bookTitle,
        author: bookAuthor || null,
        total_pages: totalPages,
        total_chapters: chaptersList.length,
        pdf_url: pdfUrl,
        processing_status: 'processing',
        processed_chapters: 0,
        chapters_data: chaptersList, // 章リストをJSONで保存
      })
      .select()
      .single();

    if (bookError || !book) {
      console.error('Book creation error:', bookError);
      throw new Error('Failed to create book record');
    }

    console.log(`Book created: ${book.id}`);

    // 即座にレスポンスを返す（処理はフロントから章ごとに呼び出される）
    return NextResponse.json({
      success: true,
      bookId: book.id,
      totalChapters: chaptersList.length,
      chapters: chaptersList,
      message: 'Book created. Start processing chapters.',
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
