import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDefaultLLMProvider } from '@/lib/llm/factory';
import type { Message } from '@/lib/llm/types';

interface ReviewQuestion {
  question: string;
  answer: string;
  explanation: string;
  why_important: string;
  difficulty_level: number;
  related_concepts: string[];
}

const REVIEW_GENERATION_PROMPT = `あなたは優秀な教育者です。以下のチャット会話履歴を分析し、学習者の理解度を確認するための復習問題を生成してください。

【生成する問題の要件】
- 会話で説明した内容から、重要なポイントを抽出して問題を作成
- 各問題には以下の情報を含める：
  - question: 問題文
  - answer: 正解（簡潔に）
  - explanation: 詳しい解説
  - why_important: なぜこの内容が重要か
  - difficulty_level: 難易度（1-5、1が最も簡単）
  - related_concepts: 関連する概念のリスト

【出力形式】
以下のJSON形式で、3〜5問の問題を生成してください：
{
  "questions": [
    {
      "question": "問題文",
      "answer": "正解",
      "explanation": "解説",
      "why_important": "重要性の説明",
      "difficulty_level": 3,
      "related_concepts": ["概念1", "概念2"]
    }
  ]
}

【チャット履歴】
`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, bookId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // セッションの所有権確認
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, book_id, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // セッションのメッセージ履歴を取得
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Failed to fetch messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    if (!messages || messages.length < 2) {
      return NextResponse.json(
        { error: 'Not enough conversation to generate review questions' },
        { status: 400 }
      );
    }

    // チャット履歴をテキスト形式に変換
    const chatHistory = messages
      .map((msg) => {
        const role = msg.role === 'user' ? '学習者' : 'AI家庭教師';
        return `【${role}】\n${msg.content}`;
      })
      .join('\n\n---\n\n');

    // LLMで復習問題を生成
    const llmProvider = createDefaultLLMProvider();
    const systemMessage: Message = {
      role: 'system',
      content: REVIEW_GENERATION_PROMPT + chatHistory,
    };

    const userMessage: Message = {
      role: 'user',
      content: '上記のチャット履歴から復習問題を生成してください。',
    };

    console.log('Generating review questions...');
    const response = await llmProvider.generateText([systemMessage, userMessage]);

    // JSONを抽出
    let questions: ReviewQuestion[] = [];
    try {
      // JSON部分を抽出（コードブロック内またはそのまま）
      const jsonMatch = response.match(/```json?\s*([\s\S]*?)```/) ||
                        response.match(/\{[\s\S]*"questions"[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        questions = parsed.questions || [];
      }
    } catch (parseError) {
      console.error('Failed to parse review questions:', parseError);
      console.error('Raw response:', response);
      return NextResponse.json(
        { error: 'Failed to parse generated questions' },
        { status: 500 }
      );
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions generated' },
        { status: 500 }
      );
    }

    // 復習問題をデータベースに保存
    const questionsToInsert = questions.map((q) => ({
      user_id: user.id,
      book_id: bookId || session.book_id,
      chat_session_id: sessionId,
      question: q.question,
      answer: q.answer,
      explanation: q.explanation,
      why_important: q.why_important,
      difficulty_level: q.difficulty_level || 3,
      related_concepts: q.related_concepts || [],
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('review_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error('Failed to insert review questions:', insertError);
      return NextResponse.json(
        { error: 'Failed to save review questions' },
        { status: 500 }
      );
    }

    // 各問題の review_history 初期エントリを作成
    if (insertedQuestions && insertedQuestions.length > 0) {
      const historyEntries = insertedQuestions.map((q) => ({
        user_id: user.id,
        question_id: q.id,
        quality: 0, // 未回答
        easiness_factor: 2.5, // SM-2 デフォルト
        interval: 1,
        repetitions: 0,
        next_review_date: new Date().toISOString().split('T')[0], // 今日から復習可能
      }));

      const { error: historyError } = await supabase
        .from('review_history')
        .insert(historyEntries);

      if (historyError) {
        console.error('Failed to create review history:', historyError);
        // 続行（問題は保存済み）
      }
    }

    // セッションをクローズ
    await supabase
      .from('chat_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      questionsCount: questions.length,
      questions: insertedQuestions,
      message: `${questions.length}問の復習問題を生成しました`,
    });

  } catch (error) {
    console.error('End session API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to end session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
