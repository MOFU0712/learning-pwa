import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// システムプロンプト一覧取得
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: prompts, error } = await supabase
      .from('system_prompts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ prompts: prompts || [] });
  } catch (error) {
    console.error('Get prompts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

// 新規プロンプト作成
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, content, is_default } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }

    // デフォルトに設定する場合、既存のデフォルトを解除
    if (is_default) {
      await supabase
        .from('system_prompts')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true);
    }

    const { data: prompt, error } = await supabase
      .from('system_prompts')
      .insert({
        user_id: user.id,
        name,
        content,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Create prompt error:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}
