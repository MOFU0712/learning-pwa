import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // セッションの所有権確認
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // セッションのメッセージを削除
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.error('Failed to delete messages:', deleteError);
      return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
    }

    // セッションも削除（新しいセッションを開始するため）
    await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      message: 'Chat history cleared',
    });

  } catch (error) {
    console.error('Clear history API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
