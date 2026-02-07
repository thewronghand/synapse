import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getDraftsDir } from "@/lib/notes-path";

export interface Draft {
  slug: string;
  title: string;
  content: string;
  tags: string[];
  folder: string;
  lastSaved: string;
}

/**
 * GET /api/drafts?slug=xxx
 * 특정 slug의 드래프트 조회
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const draftsDir = getDraftsDir();
    const draftPath = path.join(draftsDir, `${slug}.draft.json`);

    const content = await fs.readFile(draftPath, "utf-8");
    const draft: Draft = JSON.parse(content);

    return NextResponse.json(draft);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // 드래프트가 없으면 200 OK로 null 반환 (404 에러 로그 방지)
      return NextResponse.json({ draft: null });
    }
    console.error("Failed to read draft:", error);
    return NextResponse.json({ error: "Failed to read draft" }, { status: 500 });
  }
}

/**
 * POST /api/drafts
 * 드래프트 저장
 */
export async function POST(request: NextRequest) {
  try {
    const draft: Draft = await request.json();

    if (!draft.slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const draftsDir = getDraftsDir();

    // 디렉토리 생성 (없으면)
    await fs.mkdir(draftsDir, { recursive: true });

    const draftPath = path.join(draftsDir, `${draft.slug}.draft.json`);

    // lastSaved 자동 설정
    const draftWithTimestamp: Draft = {
      ...draft,
      lastSaved: new Date().toISOString(),
    };

    await fs.writeFile(draftPath, JSON.stringify(draftWithTimestamp, null, 2));

    return NextResponse.json({ success: true, draft: draftWithTimestamp });
  } catch (error) {
    console.error("Failed to save draft:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

/**
 * DELETE /api/drafts?slug=xxx
 * 드래프트 삭제
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const draftsDir = getDraftsDir();
    const draftPath = path.join(draftsDir, `${slug}.draft.json`);

    await fs.unlink(draftPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // 파일이 없어도 성공으로 처리 (이미 삭제됨)
      return NextResponse.json({ success: true });
    }
    console.error("Failed to delete draft:", error);
    return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 });
  }
}
