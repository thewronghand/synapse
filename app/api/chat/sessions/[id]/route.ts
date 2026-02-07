import { NextRequest, NextResponse } from "next/server";
import {
  loadSession,
  saveSession,
  deleteSession,
} from "@/lib/chat-session-utils";

// GET: 세션 상세 조회 (메시지 포함, 페이지네이션 지원)
// Query params:
//   - limit: 가져올 메시지 수 (기본: 전체, 10 이상 권장)
//   - before: 이 인덱스 이전의 메시지만 가져옴 (역방향 페이지네이션)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await loadSession(id);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "세션을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 페이지네이션 파라미터
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const beforeParam = url.searchParams.get("before");

    // limit이 없으면 전체 반환 (기존 동작 유지)
    if (!limitParam) {
      return NextResponse.json({ success: true, data: session });
    }

    const limit = Math.max(1, parseInt(limitParam, 10) || 10);
    const totalMessages = session.messages.length;

    // before: 해당 인덱스 이전 메시지만 (없으면 맨 끝에서부터)
    const endIndex = beforeParam ? Math.min(parseInt(beforeParam, 10), totalMessages) : totalMessages;
    const startIndex = Math.max(0, endIndex - limit);

    const paginatedMessages = session.messages.slice(startIndex, endIndex);
    const hasMore = startIndex > 0;

    return NextResponse.json({
      success: true,
      data: {
        ...session,
        messages: paginatedMessages,
        pagination: {
          total: totalMessages,
          hasMore,
          nextBefore: hasMore ? startIndex : null,
        },
      },
    });
  } catch (err) {
    console.error("[ChatSessions] 세션 조회 실패:", err);
    return NextResponse.json(
      { success: false, error: "세션을 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

// DELETE: 세션 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSession(id);

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    console.error("[ChatSessions] 세션 삭제 실패:", err);
    return NextResponse.json(
      { success: false, error: "세션을 삭제할 수 없습니다" },
      { status: 500 }
    );
  }
}

// PATCH: 세션 제목 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const title = body.title as string | undefined;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "제목이 필요합니다" },
        { status: 400 }
      );
    }

    const session = await loadSession(id);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "세션을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    session.title = title.trim();
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    console.error("[ChatSessions] 세션 수정 실패:", err);
    return NextResponse.json(
      { success: false, error: "세션을 수정할 수 없습니다" },
      { status: 500 }
    );
  }
}
