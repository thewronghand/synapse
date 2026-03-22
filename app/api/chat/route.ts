import { NextRequest, NextResponse } from "next/server";
import { type UIMessage } from "ai";
import { createNeuroAgent } from "@/lib/mastra/agents/neuro-agent";
import { loadGcpServiceAccount } from "@/lib/gcp-service-account";
import { isPublishedMode } from "@/lib/env";
import { loadSession, saveSession } from "@/lib/chat-session-utils";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  if (isPublishedMode()) {
    return NextResponse.json(
      { success: false, error: "이 기능은 퍼블리시 모드에서 사용할 수 없습니다." },
      { status: 403 }
    );
  }

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
      documentContext,
    }: {
      messages: UIMessage[];
      sessionId?: string;
      documentContext?: {
        title: string;
        folder: string;
        content?: string;
        selectedText?: string;
      };
    } = body;

    // Mastra Agent 생성 (동적 모델 로딩)
    const agent = await createNeuroAgent();;

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

    // 문서 컨텍스트가 있으면 메시지에 주입
    let enrichedMessage = userMessage;
    if (documentContext) {
      const contextParts: string[] = [];
      contextParts.push(`[현재 보고 있는 문서: "${documentContext.title}" (${documentContext.folder} 폴더)]`);
      if (documentContext.selectedText) {
        contextParts.push(`[선택한 텍스트: "${documentContext.selectedText}"]`);
      }
      if (documentContext.content) {
        contextParts.push(`[문서 내용 일부:\n${documentContext.content.slice(0, 2000)}]`);
      }
      enrichedMessage = `${contextParts.join("\n")}\n\n${userMessage}`;
    }

    // Mastra Agent 스트리밍 호출
    // Mastra Memory가 자체적으로 대화 이력을 관리함
    // thread: 세션 ID (대화 이력 저장)
    // resource: 사용자 ID (Working Memory 범위)
    const threadId = sessionId || crypto.randomUUID();
    const resourceId = "default-user"; // TODO: 다중 사용자 지원 시 변경

    const mastraOutput = await agent.stream(enrichedMessage, {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });
    // Mastra fullStream을 사용하여 tool 이벤트 포함 스트리밍
    // fullStream: text, tool-call, tool-result 등 모든 청크 타입 포함
    const fullStream = mastraOutput.fullStream;
    const messageId = crypto.randomUUID();
    const textId = crypto.randomUUID();

    // 응답 텍스트를 수집 (백그라운드 저장용)
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = fullStream.getReader();

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

            // Mastra fullStream 청크: { type, payload, ... }
            const chunk = value as {
              type: string;
              payload?: {
                text?: string;
                toolCallId?: string;
                toolName?: string;
                args?: Record<string, unknown>;
                result?: unknown;
                [key: string]: unknown;
              };
              [key: string]: unknown;
            };

            switch (chunk.type) {
              case "text-delta": {
                // Mastra 텍스트 청크: payload.text
                const text = chunk.payload?.text ?? "";
                if (text) {
                  fullResponse += text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      type: "text-delta",
                      id: textId,
                      delta: text,
                    })}\n\n`)
                  );
                }
                break;
              }

              case "tool-call": {
                // Mastra Tool 호출: payload.toolCallId, payload.toolName, payload.args
                const payload = chunk.payload;
                if (!payload) break;

                const toolCallId = payload.toolCallId ?? "";
                const toolName = payload.toolName ?? "";
                const args = payload.args ?? {};

                if (!toolCallId || !toolName) {
                  console.warn(`[Chat] Invalid tool-call chunk:`, chunk);
                  break;
                }

                // tool-input-start: Tool 호출 시작 신호
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "tool-input-start",
                    toolCallId,
                    toolName,
                  })}\n\n`)
                );

                // tool-input-available: Tool 입력 완료 (args 포함)
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "tool-input-available",
                    toolCallId,
                    toolName,
                    input: args,
                  })}\n\n`)
                );
                break;
              }

              case "tool-result": {
                // Mastra Tool 결과: payload.toolCallId, payload.result
                const payload = chunk.payload;
                if (!payload) break;

                const toolCallId = payload.toolCallId ?? "";
                const result = payload.result;

                if (!toolCallId) {
                  console.warn(`[Chat] Invalid tool-result chunk:`, chunk);
                  break;
                }

                // tool-output-available: Tool 결과 전송
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "tool-output-available",
                    toolCallId,
                    output: result,
                  })}\n\n`)
                );
                break;
              }

              case "source": {
                // Grounding 검색 결과 출처
                const payload = chunk.payload as {
                  id?: string;
                  url?: string;
                  title?: string;
                  sourceType?: string;
                } | undefined;
                if (payload?.url) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      type: "source",
                      id: payload.id,
                      url: payload.url,
                      title: payload.title || "",
                    })}\n\n`)
                  );
                }
                break;
              }

              // tool-call-input-streaming-start, tool-call-delta 등은 무시 (최종 tool-call만 처리)
              default:
                // 기타 청크는 무시
                break;
            }
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
