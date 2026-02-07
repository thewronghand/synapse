import { NextRequest, NextResponse } from "next/server";
import {
  loadAIModelSettings,
  saveAIModelSettings,
  AI_MODELS,
  DEFAULT_MODEL_ID,
} from "@/lib/ai-model-settings";
import { clearNeuroCache } from "@/lib/mastra/agents/neuro-agent";

// GET: 현재 모델 설정 조회
export async function GET() {
  try {
    const settings = await loadAIModelSettings();
    return NextResponse.json({
      success: true,
      data: {
        modelId: settings.modelId,
        models: AI_MODELS,
        defaultModelId: DEFAULT_MODEL_ID,
      },
    });
  } catch (err) {
    console.error("[AI Model] 설정 조회 실패:", err);
    return NextResponse.json(
      { success: false, error: "모델 설정을 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

// POST: 모델 설정 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId } = body as { modelId: string };

    // 유효한 모델인지 확인
    const isValid = AI_MODELS.some((m) => m.id === modelId);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 모델입니다" },
        { status: 400 }
      );
    }

    await saveAIModelSettings({ modelId });

    // 모델 변경 시 Agent 캐시 초기화
    clearNeuroCache();

    return NextResponse.json({
      success: true,
      data: { modelId },
    });
  } catch (err) {
    console.error("[AI Model] 설정 저장 실패:", err);
    return NextResponse.json(
      { success: false, error: "모델 설정을 저장할 수 없습니다" },
      { status: 500 }
    );
  }
}
