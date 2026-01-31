import { NextRequest, NextResponse } from "next/server";
import { selectPhraseSet } from "@/lib/phrase-sets";

/**
 * POST /api/phrase-sets/select
 * 구문 세트 선택 변경
 */
export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (id !== null && typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "잘못된 요청입니다" },
        { status: 400 }
      );
    }

    await selectPhraseSet(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PhraseSets] 선택 변경 실패:", error);
    return NextResponse.json(
      { success: false, error: "구문 세트 선택에 실패했습니다" },
      { status: 500 }
    );
  }
}
