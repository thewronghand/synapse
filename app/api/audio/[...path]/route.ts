import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getNotesDir } from "@/lib/notes-path";

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
};

/**
 * GET /api/audio/[...path]
 * 폴더 기반 오디오 파일 서빙
 *
 * 경로 형식:
 *   /api/audio/{folder}/{filename}         -> notes/{folder}/audio/{filename}
 *   /api/audio/{folder}/temp/{filename}    -> notes/{folder}/audio/temp/{filename}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (pathSegments.length < 2) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 오디오 경로입니다" },
        { status: 400 }
      );
    }

    const folder = pathSegments[0];
    let filename: string;
    let isTemp = false;

    if (pathSegments[1] === "temp" && pathSegments.length >= 3) {
      isTemp = true;
      filename = pathSegments.slice(2).join("/");
    } else {
      filename = pathSegments.slice(1).join("/");
    }

    // 디렉토리 순회 공격 방지
    if (
      folder.includes("..") ||
      folder.includes("~") ||
      filename.includes("..") ||
      filename.includes("~")
    ) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 파일 경로입니다" },
        { status: 400 }
      );
    }

    const notesDir = getNotesDir();
    const filePath = isTemp
      ? path.join(notesDir, folder, "audio", "temp", filename)
      : path.join(notesDir, folder, "audio", filename);

    // notes 디렉토리 내부인지 확인
    const realPath = await fs.realpath(filePath);
    if (!realPath.startsWith(notesDir)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 파일 경로입니다" },
        { status: 403 }
      );
    }

    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || "application/octet-stream";

    const cacheControl = isTemp
      ? "public, max-age=3600"
      : "public, max-age=31536000, immutable";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Cache-Control": cacheControl,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("오디오 파일 서빙 실패:", error);
    return NextResponse.json(
      { success: false, error: "오디오 파일을 찾을 수 없습니다" },
      { status: 404 }
    );
  }
}
