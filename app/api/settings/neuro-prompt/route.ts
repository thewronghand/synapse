import { NextRequest, NextResponse } from "next/server";
import {
  loadNeuroPromptConfig,
  saveNeuroPromptConfig,
  resetNeuroPromptConfig,
  NEURO_BASE_INSTRUCTIONS,
} from "@/lib/neuro-prompt";
import { clearNeuroCache } from "@/lib/mastra/agents/neuro-agent";

// GET: 현재 프롬프트 설정 조회
export async function GET() {
  try {
    const config = await loadNeuroPromptConfig();

    return NextResponse.json({
      success: true,
      data: {
        baseInstructions: NEURO_BASE_INSTRUCTIONS,
        customInstructions: config.customInstructions,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Neuro Prompt] 설정 로드 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: "프롬프트 설정을 불러올 수 없습니다",
      },
      { status: 500 }
    );
  }
}

// POST: 커스텀 지시사항 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customInstructions } = body as { customInstructions: string };

    if (typeof customInstructions !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "customInstructions는 문자열이어야 합니다",
        },
        { status: 400 }
      );
    }

    const config = await saveNeuroPromptConfig({
      customInstructions: customInstructions.trim(),
    });

    // 프롬프트 변경 시 Agent 캐시 초기화
    clearNeuroCache();

    return NextResponse.json({
      success: true,
      data: {
        customInstructions: config.customInstructions,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Neuro Prompt] 설정 저장 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: "프롬프트 설정을 저장할 수 없습니다",
      },
      { status: 500 }
    );
  }
}

// DELETE: 커스텀 지시사항 초기화
export async function DELETE() {
  try {
    const config = await resetNeuroPromptConfig();

    // 프롬프트 초기화 시 Agent 캐시 초기화
    clearNeuroCache();

    return NextResponse.json({
      success: true,
      data: {
        customInstructions: config.customInstructions,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Neuro Prompt] 설정 초기화 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: "프롬프트 설정을 초기화할 수 없습니다",
      },
      { status: 500 }
    );
  }
}
