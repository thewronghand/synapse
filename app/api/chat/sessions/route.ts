import { NextRequest, NextResponse } from "next/server";
import {
  listSessions,
  createSession,
} from "@/lib/chat-session-utils";

// GET: 세션 목록 조회
export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({
      success: true,
      data: { sessions, count: sessions.length },
    });
  } catch (err) {
    console.error("[ChatSessions] 목록 조회 실패:", err);
    return NextResponse.json(
      { success: false, error: "세션 목록을 불러올 수 없습니다" },
      { status: 500 }
    );
  }
}

// POST: 새 세션 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = body.title as string | undefined;
    const session = await createSession(title);

    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    console.error("[ChatSessions] 세션 생성 실패:", err);
    return NextResponse.json(
      { success: false, error: "세션을 생성할 수 없습니다" },
      { status: 500 }
    );
  }
}
