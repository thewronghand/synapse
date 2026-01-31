import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { getFolderTempAudioDir } from "@/lib/notes-path";

const VALID_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
  "audio/aac",
];

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * POST /api/upload/audio?folder=default
 * 오디오 파일을 지정된 폴더의 temp 디렉토리에 업로드
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder");

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "folder 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("audio") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "오디오 파일이 없습니다" },
        { status: 400 }
      );
    }

    // MIME 타입에서 codecs 파라미터 제거 후 비교 (예: "audio/webm;codecs=opus" → "audio/webm")
    const baseType = file.type.split(";")[0].trim();
    if (!VALID_TYPES.includes(baseType)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "지원하지 않는 파일 형식입니다. MP3, M4A, WAV, WebM, OGG 형식만 허용됩니다.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "파일 크기가 100MB를 초과합니다" },
        { status: 400 }
      );
    }

    // 고유 파일명 생성
    const timestamp = new Date().toISOString().split("T")[0];
    const randomId = randomBytes(6).toString("hex");
    const extension = path.extname(file.name) || ".webm";
    const filename = `${timestamp}-${randomId}${extension}`;

    // temp 디렉토리 생성 및 저장
    const tempDir = getFolderTempAudioDir(folder);
    await fs.mkdir(tempDir, { recursive: true });

    const filePath = path.join(tempDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const apiPath = `/api/audio/${folder}/temp/${filename}`;

    console.log(
      `[AudioUpload] Uploaded temp audio: ${folder}/${filename} (${Math.round(file.size / 1024)}KB)`
    );

    return NextResponse.json({
      success: true,
      data: {
        filename,
        path: apiPath,
        folder,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error("오디오 업로드 실패:", error);
    return NextResponse.json(
      { success: false, error: "오디오 업로드에 실패했습니다" },
      { status: 500 }
    );
  }
}
