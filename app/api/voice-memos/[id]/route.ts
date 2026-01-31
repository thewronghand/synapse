import { NextRequest, NextResponse } from "next/server";
import {
  findVoiceMemoById,
  readVoiceMemoMeta,
  writeVoiceMemoMeta,
  deleteVoiceMemo,
} from "@/lib/voice-memo-utils";
import type { VoiceMemoMeta } from "@/types";

/**
 * GET /api/voice-memos/[id]
 * 단일 음성 메모 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memo = await findVoiceMemoById(id);

    if (!memo) {
      return NextResponse.json(
        { success: false, error: "음성 메모를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: memo });
  } catch (error) {
    console.error("[VoiceMemos] 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "음성 메모 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/voice-memos/[id]
 * 음성 메모 업데이트 (전사 결과, 요약 결과 등)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { folder, ...updates } = body as {
      folder: string;
      status?: VoiceMemoMeta["status"];
      transcript?: string;
      summary?: string;
    };

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "folder가 필요합니다" },
        { status: 400 }
      );
    }

    const existing = await readVoiceMemoMeta(folder, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "음성 메모를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const updated: VoiceMemoMeta = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await writeVoiceMemoMeta(folder, updated);

    console.log(`[VoiceMemos] 업데이트: ${folder}/${id} → ${updated.status}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[VoiceMemos] 업데이트 실패:", error);
    return NextResponse.json(
      { success: false, error: "음성 메모 업데이트에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/voice-memos/[id]?folder=default
 * 음성 메모 삭제 (오디오 파일 + 메타데이터)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folder = request.nextUrl.searchParams.get("folder");

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "folder 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    await deleteVoiceMemo(folder, id);

    console.log(`[VoiceMemos] 삭제: ${folder}/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VoiceMemos] 삭제 실패:", error);
    const message =
      error instanceof Error ? error.message : "음성 메모 삭제에 실패했습니다";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
