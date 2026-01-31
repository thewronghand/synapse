import { NextRequest, NextResponse } from "next/server";
import { updatePhraseSet, deletePhraseSet } from "@/lib/phrase-sets";

/**
 * PATCH /api/phrase-sets/:id
 * 구문 세트 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phrases } = body as {
      name?: string;
      phrases?: string[];
    };

    const updates: { name?: string; phrases?: string[] } = {};
    if (name !== undefined) updates.name = name.trim();
    if (phrases !== undefined) {
      updates.phrases = phrases.map((p: string) => p.trim()).filter(Boolean);
    }

    const updated = await updatePhraseSet(id, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "구문 세트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PhraseSets] 수정 실패:", error);
    return NextResponse.json(
      { success: false, error: "구문 세트 수정에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/phrase-sets/:id
 * 구문 세트 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deletePhraseSet(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "구문 세트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PhraseSets] 삭제 실패:", error);
    return NextResponse.json(
      { success: false, error: "구문 세트 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
}
