import { NextRequest, NextResponse } from "next/server";
import {
  loadSession,
  saveSession,
  generateSessionTitle,
} from "@/lib/chat-session-utils";
import type { ChatMessage } from "@/types";

// PATCH: 메시지 수정 (해당 메시지 이후의 모든 메시지 삭제)
// messageId가 있으면 해당 메시지 수정, 없으면 마지막 사용자 메시지 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { messageId, content } = body as { messageId?: string; content: string };

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: "메시지 내용이 필요합니다" },
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

    // messageId가 있으면 해당 메시지, 없으면 마지막 사용자 메시지 찾기
    let messageIndex = -1;
    if (messageId) {
      messageIndex = session.messages.findIndex((m) => m.id === messageId);
    }
    // ID로 못 찾으면 마지막 사용자 메시지 찾기
    if (messageIndex === -1) {
      for (let i = session.messages.length - 1; i >= 0; i--) {
        if (session.messages[i].role === "user") {
          messageIndex = i;
          break;
        }
      }
    }
    if (messageIndex === -1) {
      return NextResponse.json(
        { success: false, error: "수정할 사용자 메시지를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 메시지 수정
    session.messages[messageIndex].content = content.trim();

    // 해당 메시지 이후의 모든 메시지 삭제 (재생성을 위해)
    session.messages = session.messages.slice(0, messageIndex + 1);

    // 응답 대기 상태로 설정
    session.pendingResponse = true;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json({
      success: true,
      data: { messages: session.messages },
    });
  } catch (err) {
    console.error("[ChatSessions] 메시지 수정 실패:", err);
    return NextResponse.json(
      { success: false, error: "메시지를 수정할 수 없습니다" },
      { status: 500 }
    );
  }
}

// DELETE: 마지막 assistant 메시지 삭제 (재생성용)
export async function DELETE(
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

    // 마지막 메시지가 assistant인지 확인
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") {
      return NextResponse.json(
        { success: false, error: "삭제할 assistant 메시지가 없습니다" },
        { status: 400 }
      );
    }

    // 마지막 assistant 메시지 삭제
    session.messages.pop();
    session.pendingResponse = true;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);

    return NextResponse.json({
      success: true,
      data: { messages: session.messages },
    });
  } catch (err) {
    console.error("[ChatSessions] 메시지 삭제 실패:", err);
    return NextResponse.json(
      { success: false, error: "메시지를 삭제할 수 없습니다" },
      { status: 500 }
    );
  }
}

// POST: 세션에 메시지 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { message } = body as { message: ChatMessage };

    if (!message || !message.role || !message.content) {
      return NextResponse.json(
        { success: false, error: "유효한 메시지가 필요합니다" },
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

    // 메시지 추가
    const now = new Date().toISOString();
    const newMessage: ChatMessage = {
      id: message.id || crypto.randomUUID(),
      role: message.role,
      content: message.content,
      createdAt: message.createdAt || now,
    };
    session.messages.push(newMessage);

    // 첫 사용자 메시지면 제목 생성
    if (
      session.messages.length === 1 &&
      message.role === "user" &&
      session.title === "새 대화"
    ) {
      session.title = generateSessionTitle(message.content);
    }

    // 사용자 메시지면 응답 대기 상태로 설정
    if (message.role === "user") {
      session.pendingResponse = true;
    }
    // AI 응답이면 대기 상태 해제
    if (message.role === "assistant") {
      session.pendingResponse = false;
    }

    session.updatedAt = now;
    await saveSession(session);

    return NextResponse.json({
      success: true,
      data: { message: newMessage, title: session.title },
    });
  } catch (err) {
    console.error("[ChatSessions] 메시지 추가 실패:", err);
    return NextResponse.json(
      { success: false, error: "메시지를 추가할 수 없습니다" },
      { status: 500 }
    );
  }
}
