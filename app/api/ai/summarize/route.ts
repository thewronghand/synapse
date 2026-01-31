import { NextRequest, NextResponse } from "next/server";
import { loadGcpServiceAccount } from "@/lib/gcp-service-account";
import { createMeetingSummaryAgent } from "@/mastra/agents/meeting-summary";

/**
 * POST /api/ai/summarize
 * 전사 텍스트를 구조화된 회의록으로 요약
 * Body: { transcript: string }
 */
export async function POST(request: NextRequest) {
  try {
    const sa = await loadGcpServiceAccount();
    if (!sa) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GCP 서비스 어카운트가 설정되지 않았습니다. 설정에서 먼저 연동해주세요.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { success: false, error: "전사 텍스트가 없습니다" },
        { status: 400 }
      );
    }

    const agent = createMeetingSummaryAgent(sa);
    const result = await agent.generate(
      `다음 회의 녹취록을 정리해주세요:\n\n${transcript}`
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: result.text,
      },
    });
  } catch (error) {
    console.error("요약 실패:", error);
    const message =
      error instanceof Error ? error.message : "요약 중 오류가 발생했습니다";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
