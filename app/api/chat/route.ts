import { streamText, type UIMessage, convertToModelMessages } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { NextRequest, NextResponse } from "next/server";
import { loadGcpServiceAccount } from "@/lib/gcp-service-account";
import {
  loadSession,
  createSession,
  appendMessage,
  saveSession,
  generateSessionTitle,
} from "@/lib/chat-session-utils";
import { loadAIModelSettings } from "@/lib/ai-model-settings";
import crypto from "crypto";

const SYSTEM_PROMPT = `당신의 이름은 Neuro입니다. Synapse 노트 앱에 내장된 AI 어시스턴트입니다.
"뉴런(Neuron)"에서 따온 이름으로, 시냅스를 통해 지식을 연결하는 것처럼 사용자의 생각을 연결하고 확장하는 역할을 합니다.

## Synapse 앱 소개
Synapse는 마크다운 기반 개인 지식 관리(PKM) 데스크톱 앱입니다. 주요 기능:

- **노트 작성/편집**: 마크다운 에디터로 문서 CRUD. 폴더별 정리 가능.
- **위키링크**: \`[[문서명]]\` 문법으로 문서 간 연결. 자동 백링크 생성.
- **그래프 시각화**: D3.js 기반 인터랙티브 그래프로 문서 간 관계를 시각적으로 탐색.
- **태그 시스템**: 프론트매터에 태그를 지정하여 문서 분류 및 검색.
- **음성 메모**: 음성 녹음/업로드 → Google Speech-to-Text 자동 녹취록 생성 → AI 요약. 화자 분리(Speaker Diarization) 지원.
- **퍼블리시**: Vercel 연동으로 노트를 읽기 전용 웹사이트로 배포. 폴더별 공개/비공개 설정 가능.
- **검색**: 제목 검색(자동완성) + 본문 전체 검색 + 태그 필터링.
- **AI 챗봇**: 바로 당신(Neuro)! 사용자의 질문에 답변하는 대화형 AI.

## 응답 가이드라인
- 한국어로 응답하되, 사용자가 다른 언어로 질문하면 해당 언어로 답변하세요.
- 마크다운을 적극 활용하여 가독성 좋게 작성하세요 (헤딩, 리스트, 코드블록, 굵은 글씨 등).
- 간결하면서도 충분한 정보를 담아 답변하세요. 불필요하게 길게 늘리지 마세요.
- 사용자가 Synapse 기능에 대해 물으면 위 정보를 바탕으로 안내해주세요.
- 코드, 개발, 학습, 일반 지식 등 폭넓은 주제에 답변할 수 있습니다.
- 확실하지 않은 정보는 솔직하게 모른다고 말해주세요.`;;

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
      sessionId: requestedSessionId,
    }: {
      messages: UIMessage[];
      sessionId?: string;
    } = body;

    // 세션 확인 또는 생성
    let sessionId = requestedSessionId;
    if (sessionId) {
      const existingSession = await loadSession(sessionId);
      if (!existingSession) {
        const newSession = await createSession();
        sessionId = newSession.id;
      }
    } else {
      const newSession = await createSession();
      sessionId = newSession.id;
    }

    // 마지막 user 메시지 저장
    const lastUiMessage = uiMessages[uiMessages.length - 1];
    if (lastUiMessage && lastUiMessage.role === "user") {
      // UIMessage에서 텍스트 추출
      const textContent =
        lastUiMessage.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text"
          )
          .map((p) => p.text)
          .join("") ?? "";

      await appendMessage(sessionId, {
        id: crypto.randomUUID(),
        role: "user",
        content: textContent,
        createdAt: new Date().toISOString(),
      });
    }

    // 모델 설정 로드
    const aiSettings = await loadAIModelSettings();

    // Gemini 3 모델은 global 리전 필요
    const isGemini3 = aiSettings.modelId.startsWith("gemini-3");
    const location = isGemini3 ? "global" : "us-central1";

    // Vertex AI 모델 생성
    const vertex = createVertex({
      project: sa.project_id,
      location,
      googleAuthOptions: {
        credentials: {
          client_email: sa.client_email,
          private_key: sa.private_key,
        },
      },
    });

    // UIMessage → ModelMessage 변환 후 스트리밍 응답 생성
    const modelMessages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model: vertex(aiSettings.modelId),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      onFinish: async ({ text }) => {
        try {
          // assistant 응답 저장
          await appendMessage(sessionId, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: text,
            createdAt: new Date().toISOString(),
          });

          // 첫 대화면 자동 제목 생성
          const session = await loadSession(sessionId);
          if (session && session.messages.length === 2) {
            const userMsg = session.messages.find((m) => m.role === "user");
            if (userMsg) {
              session.title = generateSessionTitle(userMsg.content);
              session.updatedAt = new Date().toISOString();
              await saveSession(session);
            }
          }
        } catch (err) {
          console.error("[Chat] 응답 저장 실패:", err);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "X-Session-Id": sessionId,
      },
    });
  } catch (err) {
    console.error("[Chat] 스트리밍 실패:", err);
    return NextResponse.json(
      { success: false, error: "AI 응답을 생성할 수 없습니다" },
      { status: 500 }
    );
  }
}
