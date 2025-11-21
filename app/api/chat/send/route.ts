import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings';
import { createDefaultLLMProvider } from '@/lib/llm/factory';
import type { Message } from '@/lib/llm/types';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { bookId, chapterId, sessionId, message } = await request.json();

    if (!bookId || !message) {
      return new Response('Missing required fields', { status: 400 });
    }

    // セッション取得または作成
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          book_id: bookId,
          chapter_id: chapterId || null,
          llm_provider: 'gemini-flash',
          status: 'active',
        })
        .select()
        .single();

      if (sessionError || !newSession) {
        throw new Error('Failed to create chat session');
      }

      currentSessionId = newSession.id;
    }

    // ユーザーメッセージをデータベースに保存
    const { error: userMessageError } = await supabase.from('chat_messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    if (userMessageError) {
      console.error('Failed to save user message:', userMessageError);
    }

    // コンテキスト構築
    let contextText = '';
    const sectionsUsed: string[] = [];

    if (chapterId) {
      // 特定の章が選択されている場合: その章のセクションを全て取得
      console.log(`Fetching all sections for chapter: ${chapterId}`);
      const { data: chapterSections, error: sectionsError } = await supabase
        .from('sections')
        .select('id, section_number, title, content')
        .eq('chapter_id', chapterId)
        .order('section_number', { ascending: true });

      if (sectionsError) {
        console.error('Chapter sections fetch error:', sectionsError);
      }

      if (chapterSections && chapterSections.length > 0) {
        console.log(`Found ${chapterSections.length} sections in chapter`);
        contextText = chapterSections
          .map((section: any) => {
            sectionsUsed.push(section.id);
            return `## ${section.section_number}. ${section.title}\n\n${section.content}`;
          })
          .join('\n\n---\n\n');
      }
    } else {
      // 書籍全体が選択されている場合: セマンティック検索
      console.log('Generating query embedding...');
      const queryEmbedding = await generateEmbedding(message);

      console.log('Searching relevant sections across book...');
      const { data: relevantSections, error: searchError } = await supabase.rpc(
        'match_sections_by_book',
        {
          query_embedding: queryEmbedding,
          book_id_param: bookId,
          match_threshold: 0.3,
          match_count: 5,
        }
      );

      if (searchError) {
        console.error('Semantic search error:', searchError);
      }

      if (relevantSections && relevantSections.length > 0) {
        console.log(`Found ${relevantSections.length} relevant sections`);
        contextText = relevantSections
          .map((section: any) => {
            sectionsUsed.push(section.id);
            return `## ${section.title}\n\n${section.content}`;
          })
          .join('\n\n---\n\n');
      }
    }

    console.log(`Context length: ${contextText.length} chars`);

    // ユーザーのデフォルトプロンプトを取得
    let promptContent = '';
    const { data: defaultPrompt } = await supabase
      .from('system_prompts')
      .select('content')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (defaultPrompt?.content) {
      // {context} プレースホルダーを実際のコンテキストで置換
      promptContent = defaultPrompt.content.replace(
        '{context}',
        contextText || '（コンテキストが見つかりませんでした。一般的な知識で回答してください）'
      );
    } else {
      // フォールバック: デフォルトプロンプトがない場合
      promptContent = `あなたは優秀なAIチューターです。学習者の質問に対して、提供された書籍のコンテキストを基に、わかりやすく丁寧に回答してください。

【回答の方針】
- コンテキストに含まれる情報を優先的に使用してください
- 必要に応じて、具体例や図解的な説明を加えてください
- 専門用語は噛み砕いて説明してください
- 学習者の理解を深めるため、適度に質問を投げかけてください
- コンテキストに情報がない場合は、一般的な知識で補完しても構いません（その旨を明記）

【提供されたコンテキスト】
${contextText || '（コンテキストが見つかりませんでした。一般的な知識で回答してください）'}`;
    }

    // LLMプロンプト構築
    const systemMessage: Message = {
      role: 'system',
      content: promptContent,
    };

    const userMessage: Message = {
      role: 'user',
      content: message,
    };

    // LLMストリーミングレスポンス
    const llmProvider = createDefaultLLMProvider();
    console.log(`Using LLM provider: ${llmProvider.name}`);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // セッションIDを最初に送信
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`
            )
          );

          let fullResponse = '';

          // LLMからストリーミング取得
          for await (const chunk of llmProvider.generateStream([
            systemMessage,
            userMessage,
          ])) {
            fullResponse += chunk;

            // クライアントに送信
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
          }

          // 完了通知
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

          // AIレスポンスをデータベースに保存
          const { error: aiMessageError } = await supabase
            .from('chat_messages')
            .insert({
              session_id: currentSessionId,
              role: 'assistant',
              content: fullResponse,
              sections_used: sectionsUsed.length > 0 ? sectionsUsed : null,
            });

          if (aiMessageError) {
            console.error('Failed to save AI message:', aiMessageError);
          }

          // セッション更新（最終トピック、理解度は後で実装）
          await supabase
            .from('chat_sessions')
            .update({
              current_topic: message.substring(0, 100),
            })
            .eq('id', currentSessionId);

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
