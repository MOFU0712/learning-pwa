import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: books, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch books:', error);
      return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
    }

    return NextResponse.json({ books: books || [] });
  } catch (error) {
    console.error('Books API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch books',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
