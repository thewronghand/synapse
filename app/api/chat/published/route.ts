import { NextRequest, NextResponse } from "next/server";
import { createVertex } from "@ai-sdk/google-vertex";
import { embed, streamText } from "ai";
import { searchPublishedEmbeddings } from "@/lib/published-search";
import { isPublishedMode } from "@/lib/env";

// 환경변수에서 SA 로드
function getServiceAccount() {
  const saJson = process.env.GCP_SA_JSON;
  if (!saJson) return null;

  try {
    return JSON.parse(saJson);
  } catch {
    return null;
  }
}

// 퍼블리시 모드 전용 프롬프트
const PUBLISHED_CHAT_INSTRUCTIONS = `You are Neuro(뉴로), an AI assistant on this published Synapse site.
You help visitors explore and understand the documents published on this site.

## Rules
- Answer questions based ONLY on the provided document context below.
- If the context doesn't contain relevant information, say so honestly.
- Respond in the user's language. Default to Korean.
- Use markdown for readability.
- Cite document titles when referencing information.
- You cannot create, edit, or delete documents. This is a read-only site.
- Keep responses concise and helpful.`;

/**
 * POST /api/chat/published
 * 퍼블리시 사이트 전용 챗봇
 */
export async function POST(req: NextRequest) {
  // 퍼블리시 모드가 아니면 차단
  if (!isPublishedMode()) {
    return NextResponse.json(
      { success: false, error: "이 API는 퍼블리시 모드에서만 사용 가능합니다." },
      { status: 403 }
    );
  }

  try {
    const sa = getServiceAccount();
    if (!sa) {
      return NextResponse.json(
        { success: false, error: "AI 기능이 설정되지 않았습니다." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "메시지가 없습니다." },
        { status: 400 }
      );
    }

    // 마지막 사용자 메시지 추출
    const lastUserMessage = [...messages].reverse().find(
      (m: { role: string }) => m.role === "user"
    );
    if (!lastUserMessage) {
      return NextResponse.json(
        { success: false, error: "사용자 메시지가 없습니다." },
        { status: 400 }
      );
    }

    const userQuery = typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : "";

    // Vertex AI 모델 생성
    const vertex = createVertex({
      project: sa.project_id,
      location: "us-central1",
      googleAuthOptions: {
        credentials: {
          client_email: sa.client_email,
          private_key: sa.private_key,
        },
      },
    });

    const embeddingModel = vertex.embeddingModel("text-embedding-004");
    const chatModel = vertex("gemini-2.0-flash");

    // 쿼리 임베딩 생성
    const { embedding } = await embed({
      model: embeddingModel,
      value: userQuery,
    });

    // 유사 문서 검색
    const relevantChunks = await searchPublishedEmbeddings(embedding, 5);

    // 컨텍스트 구성
    const context = relevantChunks.length > 0
      ? relevantChunks
          .map((c, i) => `[${i + 1}] "${c.title}" (${c.folder})\n${c.text}`)
          .join("\n\n")
      : "관련 문서를 찾지 못했습니다.";

    const systemPrompt = `${PUBLISHED_CHAT_INSTRUCTIONS}

## Document Context
${context}`;

    // 스트리밍 응답
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Published Chat] Error:", error);
    return NextResponse.json(
      { success: false, error: "챗봇 응답 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
