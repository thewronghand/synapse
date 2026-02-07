import { NextRequest, NextResponse } from "next/server";
import {
  getWorkingMemory,
  updateWorkingMemory,
  resetWorkingMemory,
  getWorkingMemoryTemplate,
} from "@/lib/mastra/memory";

const DEFAULT_RESOURCE_ID = "default-user";

// GET: Working Memory 조회
export async function GET() {
  try {
    const content = await getWorkingMemory(DEFAULT_RESOURCE_ID);
    const template = getWorkingMemoryTemplate();

    return NextResponse.json({
      success: true,
      data: {
        content: content || "",
        template,
        isEmpty: !content || content.trim() === "",
      },
    });
  } catch (err) {
    console.error("[Working Memory] 조회 실패:", err);
    return NextResponse.json(
      { success: false, error: "Working Memory를 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

// POST: Working Memory 수정
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content } = body as { content: string };

    if (typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "content는 문자열이어야 합니다" },
        { status: 400 }
      );
    }

    await updateWorkingMemory(DEFAULT_RESOURCE_ID, content);

    return NextResponse.json({
      success: true,
      data: { content },
    });
  } catch (err) {
    console.error("[Working Memory] 수정 실패:", err);
    return NextResponse.json(
      { success: false, error: "Working Memory를 저장할 수 없습니다" },
      { status: 500 }
    );
  }
}

// DELETE: Working Memory 리셋
export async function DELETE() {
  try {
    await resetWorkingMemory(DEFAULT_RESOURCE_ID);

    return NextResponse.json({
      success: true,
      message: "Working Memory가 초기화되었습니다",
    });
  } catch (err) {
    console.error("[Working Memory] 리셋 실패:", err);
    return NextResponse.json(
      { success: false, error: "Working Memory를 초기화할 수 없습니다" },
      { status: 500 }
    );
  }
}
