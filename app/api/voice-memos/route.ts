import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  listVoiceMemos,
  writeVoiceMemoMeta,
  moveAudioFromTemp,
} from "@/lib/voice-memo-utils";
import type { VoiceMemoMeta } from "@/types";

/**
 * GET /api/voice-memos?folder=default
 * 음성 메모 목록 조회 (folder 파라미터 없으면 전체)
 */
export async function GET(request: NextRequest) {
  try {
    const folder = request.nextUrl.searchParams.get("folder") || undefined;
    const memos = await listVoiceMemos(folder);

    return NextResponse.json({
      success: true,
      data: { memos, count: memos.length },
    });
  } catch (error) {
    console.error("[VoiceMemos] 목록 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "음성 메모 목록 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/voice-memos
 * 새 음성 메모 생성 (temp에서 영구 저장소로 이동 + 메타데이터 생성)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folder, filename, duration } = body as {
      folder: string;
      filename: string;
      duration: number;
    };

    if (!folder || !filename) {
      return NextResponse.json(
        { success: false, error: "folder와 filename이 필요합니다" },
        { status: 400 }
      );
    }

    // temp → 영구 저장소로 이동
    await moveAudioFromTemp(folder, filename);

    // 메타데이터 생성
    const id = path.basename(filename, path.extname(filename));
    const now = new Date().toISOString();

    const meta: VoiceMemoMeta = {
      id,
      filename,
      folder,
      status: "recorded",
      duration: duration || 0,
      transcript: null,
      summary: null,
      createdAt: now,
      updatedAt: now,
    };

    await writeVoiceMemoMeta(folder, meta);

    console.log(
      `[VoiceMemos] 생성: ${folder}/${filename} (${duration}초)`
    );

    return NextResponse.json({
      success: true,
      data: meta,
    });
  } catch (error) {
    console.error("[VoiceMemos] 생성 실패:", error);
    const message =
      error instanceof Error ? error.message : "음성 메모 생성에 실패했습니다";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
