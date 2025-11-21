import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookId } = await params;

    // 書籍情報取得
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('user_id', user.id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // 章情報取得
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true });

    if (chaptersError) {
      console.error('Failed to fetch chapters:', chaptersError);
      return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
    }

    // 最新のアクティブなセッションとメッセージを取得
    const { data: latestSession } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('book_id', bookId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let messages: any[] = [];
    if (latestSession) {
      const { data: sessionMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', latestSession.id)
        .order('created_at', { ascending: true });

      messages = sessionMessages || [];
    }

    return NextResponse.json({
      book,
      chapters: chapters || [],
      sessionId: latestSession?.id || null,
      messages,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
