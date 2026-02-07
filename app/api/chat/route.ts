import { NextRequest, NextResponse } from "next/server";
import { type UIMessage } from "ai";
import { createNeuroAgent } from "@/lib/mastra/agents/neuro-agent";
import { loadGcpServiceAccount } from "@/lib/gcp-service-account";
import { loadSession, saveSession } from "@/lib/chat-session-utils";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    // GCP SA 확인
    const sa = await loadGcpServiceAccount();
    if (!sa) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GCP 서비스 어카운트가 설정되지 않았습니다. 설정 페이지에서 연동해주세요.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      messages: uiMessages,
      sessionId,
    }: {
      messages: UIMessage[];
      sessionId?: string;
    } = body;

    // Mastra Agent 생성 (동적 모델 로딩)
    console.log("[Chat] Agent 생성 시작...");
    const agent = await createNeuroAgent();
    console.log("[Chat] Agent 생성 완료");

    // UIMessage에서 마지막 사용자 메시지 추출
    const lastMessage = uiMessages[uiMessages.length - 1];
    const userMessage =
      lastMessage?.role === "user"
        ? lastMessage.parts
            ?.filter(
              (p): p is { type: "text"; text: string } => p.type === "text"
            )
            .map((p) => p.text)
            .join("") ?? ""
        : "";

    if (!userMessage) {
      return NextResponse.json(
        { success: false, error: "메시지가 비어있습니다." },
        { status: 400 }
      );
    }

    // Mastra Agent 스트리밍 호출
    // Mastra Memory가 자체적으로 대화 이력을 관리함
    // thread: 세션 ID (대화 이력 저장)
    // resource: 사용자 ID (Working Memory 범위)
    const threadId = sessionId || crypto.randomUUID();
    const resourceId = "default-user"; // TODO: 다중 사용자 지원 시 변경

    console.log("[Chat] 스트리밍 시작...", { userMessage, threadId, resourceId });
    const mastraOutput = await agent.stream(userMessage, {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });
    console.log("[Chat] 스트리밍 응답 수신");

    // Mastra textStream을 Vercel AI SDK v6 Data Stream Protocol 형식으로 변환
    const textStream = mastraOutput.textStream;
    const messageId = crypto.randomUUID();
    const textId = crypto.randomUUID();

    // 응답 텍스트를 수집 (백그라운드 저장용)
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = textStream.getReader();

        try {
          // 메시지 시작 신호 (필수 - 이게 있어야 로딩 UI가 표시됨)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "start", messageId })}\n\n`)
          );

          // 텍스트 시작 신호
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: textId })}\n\n`)
          );

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 응답 텍스트 수집
            fullResponse += value;

            // AI SDK v6 Data Stream Protocol: text-delta
            const data = `data: ${JSON.stringify({
              type: "text-delta",
              id: textId,
              delta: value,
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // 텍스트 완료 신호
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: textId })}\n\n`)
          );

          // 메시지 완료 신호
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`)
          );

          // 스트림 종료
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));

          // 스트리밍 완료 후 AI 응답 저장 (백그라운드)
          if (sessionId && fullResponse) {
            saveAssistantMessage(sessionId, messageId, fullResponse).catch((err) => {
              console.error("[Chat] AI 응답 저장 실패:", err);
            });
          }
        } catch (err) {
          console.error("[Chat] 스트리밍 중 오류:", err);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    // AI 응답을 세션에 저장하는 헬퍼 함수
    async function saveAssistantMessage(sid: string, msgId: string, content: string) {
      const session = await loadSession(sid);
      if (!session) return;

      // 이미 같은 ID의 메시지가 있으면 중복 저장 방지
      if (session.messages.some((m) => m.id === msgId)) {
        console.log("[Chat] AI 응답 이미 저장됨, 스킵:", msgId);
        return;
      }

      const now = new Date().toISOString();
      const assistantMsg: ChatMessage = {
        id: msgId,
        role: "assistant",
        content,
        createdAt: now,
      };
      session.messages.push(assistantMsg);
      session.pendingResponse = false; // 응답 완료
      session.updatedAt = now;
      await saveSession(session);
      console.log("[Chat] AI 응답 저장 완료:", sid);

      // 대화가 6개 이상이고 아직 AI 제목 생성 안 했으면 생성
      if (session.messages.length >= 6 && !session.titleGenerated) {
        generateAiTitle(sid, session.messages).catch((err) => {
          console.error("[Chat] AI 제목 생성 실패:", err);
        });
      }
    }

    // AI로 대화 제목 생성
    async function generateAiTitle(sid: string, messages: ChatMessage[]) {
      try {
        const titleAgent = await createNeuroAgent();
        const conversation = messages
          .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
          .join("\n");

        const result = await titleAgent.generate(
          `다음 대화의 주제를 한국어로 짧게 요약해서 제목을 만들어줘. 15자 이내로, 제목만 답변해줘.\n\n${conversation}`
        );

        const title = result.text?.trim().slice(0, 30) || "새 대화";

        // 세션 제목 업데이트 및 플래그 설정
        const session = await loadSession(sid);
        if (session) {
          session.title = title;
          session.titleGenerated = true;
          await saveSession(session);
          console.log("[Chat] AI 제목 생성 완료:", title);
        }
      } catch (err) {
        console.error("[Chat] AI 제목 생성 중 오류:", err);
      }
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Session-Id": threadId,
        "x-vercel-ai-ui-message-stream": "v1",
      },
    });
  } catch (err) {
    console.error("[Chat] 스트리밍 실패:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        error: "AI 응답을 생성할 수 없습니다",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
