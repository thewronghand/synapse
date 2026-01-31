import { NextRequest, NextResponse } from "next/server";
import { loadPhraseSetStore, addPhraseSet } from "@/lib/phrase-sets";

/**
 * GET /api/phrase-sets
 * 전체 구문 세트 목록 + 선택 상태 조회
 */
export async function GET() {
  try {
    const store = await loadPhraseSetStore();
    return NextResponse.json({ success: true, data: store });
  } catch (error) {
    console.error("[PhraseSets] 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "구문 세트 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/phrase-sets
 * 새 구문 세트 생성
 */
export async function POST(request: NextRequest) {
  try {
    const { name, phrases } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "구문 세트 이름을 입력해주세요" },
        { status: 400 }
      );
    }

    if (!Array.isArray(phrases)) {
      return NextResponse.json(
        { success: false, error: "구문 목록이 필요합니다" },
        { status: 400 }
      );
    }

    const trimmedPhrases = phrases
      .map((p: string) => p.trim())
      .filter(Boolean);

    const newSet = await addPhraseSet(name.trim(), trimmedPhrases);
    return NextResponse.json({ success: true, data: newSet });
  } catch (error) {
    console.error("[PhraseSets] 생성 실패:", error);
    return NextResponse.json(
      { success: false, error: "구문 세트 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
