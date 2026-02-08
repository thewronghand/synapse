import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import { getNotesDir } from "@/lib/notes-path";
import { TRASH_FOLDER } from "@/lib/folder-utils";

interface TrashItem {
  filename: string;
  title: string;
  deletedAt: string;
  daysRemaining: number;
}

const TRASH_RETENTION_DAYS = 30;

/**
 * GET: 휴지통 목록 조회
 */
export async function GET() {
  try {
    const notesDir = getNotesDir();
    const trashPath = path.join(notesDir, TRASH_FOLDER);

    // 휴지통 폴더가 없으면 빈 배열 반환
    if (!fss.existsSync(trashPath)) {
      return NextResponse.json({
        success: true,
        data: { items: [], retentionDays: TRASH_RETENTION_DAYS },
      });
    }

    const files = await fs.readdir(trashPath);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    const items: TrashItem[] = [];

    for (const filename of mdFiles) {
      const filePath = path.join(trashPath, filename);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, "utf-8");

      // frontmatter에서 title 추출
      let title = filename.replace(".md", "");
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const titleMatch = frontmatterMatch[1].match(/title:\s*["']?(.+?)["']?\s*$/m);
        if (titleMatch) {
          title = titleMatch[1];
        }
      }

      // 삭제 후 경과 일수 계산
      const deletedAt = stat.mtime;
      const now = new Date();
      const daysSinceDelete = Math.floor(
        (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysRemaining = Math.max(0, TRASH_RETENTION_DAYS - daysSinceDelete);

      items.push({
        filename,
        title,
        deletedAt: deletedAt.toISOString(),
        daysRemaining,
      });
    }

    // 삭제일 기준 정렬 (최신 먼저)
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return NextResponse.json({
      success: true,
      data: { items, retentionDays: TRASH_RETENTION_DAYS },
    });
  } catch (error) {
    console.error("[Trash] List error:", error);
    return NextResponse.json(
      { success: false, error: "휴지통 목록 조회 실패" },
      { status: 500 }
    );
  }
}

/**
 * POST: 문서 복구
 */
export async function POST(request: NextRequest) {
  try {
    const { filename, targetFolder = "default" } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "filename이 필요합니다." },
        { status: 400 }
      );
    }

    const notesDir = getNotesDir();
    const trashPath = path.join(notesDir, TRASH_FOLDER, filename);
    const targetPath = path.join(notesDir, targetFolder, filename);

    if (!fss.existsSync(trashPath)) {
      return NextResponse.json(
        { success: false, error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 대상 폴더 확인
    const targetFolderPath = path.join(notesDir, targetFolder);
    if (!fss.existsSync(targetFolderPath)) {
      await fs.mkdir(targetFolderPath, { recursive: true });
    }

    // 같은 이름의 파일이 있으면 이름 변경
    let finalPath = targetPath;
    let counter = 1;
    while (fss.existsSync(finalPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalPath = path.join(notesDir, targetFolder, `${base} (${counter})${ext}`);
      counter++;
    }

    await fs.rename(trashPath, finalPath);

    return NextResponse.json({
      success: true,
      data: { restoredTo: path.basename(finalPath) },
    });
  } catch (error) {
    console.error("[Trash] Restore error:", error);
    return NextResponse.json(
      { success: false, error: "문서 복구 실패" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 문서 영구 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "filename이 필요합니다." },
        { status: 400 }
      );
    }

    const notesDir = getNotesDir();
    const trashPath = path.join(notesDir, TRASH_FOLDER, filename);

    if (!fss.existsSync(trashPath)) {
      return NextResponse.json(
        { success: false, error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await fs.unlink(trashPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Trash] Delete error:", error);
    return NextResponse.json(
      { success: false, error: "문서 삭제 실패" },
      { status: 500 }
    );
  }
}
