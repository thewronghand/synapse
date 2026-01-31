import { Agent } from "@mastra/core/agent";
import { createVertex } from "@ai-sdk/google-vertex";
import type { GcpServiceAccountInfo } from "@/lib/gcp-service-account";

// SA 크레덴셜로 Vertex AI Gemini 모델 에이전트를 동적 생성
export function createMeetingSummaryAgent(sa: GcpServiceAccountInfo) {
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

  return new Agent({
    id: "meeting-summary",
    name: "meeting-summary",
    instructions: `당신은 회의 녹취록을 정리하는 전문가입니다.
주어진 녹취 텍스트를 분석하여 아래 형식의 마크다운 회의록을 작성하세요.
내용이 부족한 섹션은 생략해도 됩니다.

## 회의 개요
- 주제: (녹취 내용에서 추론)
- 참석자: (언급된 이름들 나열, 없으면 생략)

## 주요 논의사항
1. ...
2. ...

## 결정사항
- ...

## 액션 아이템
- [ ] (담당자): 할 일 내용

## 기타 메모
(필요시 추가 정보)

규칙:
- 원본 내용을 왜곡하지 마세요
- 핵심만 간결하게 정리하세요
- 한국어로 작성하세요 (원본이 영어라도 한국어로 번역)
- 마크다운 문법을 올바르게 사용하세요`,
    model: vertex("gemini-2.0-flash"),
  });
}
