import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";
import { getSynapseRootDir } from "@/lib/notes-path";
import type {
  ChatSession,
  ChatSessionMeta,
  ChatSessionIndex,
  ChatMessage,
} from "@/types";

// ─── 경로 함수 ───

function getChatSessionsDir(): string {
  return path.join(getSynapseRootDir(), ".synapse", "chat-sessions");
}

function getSessionFilePath(id: string): string {
  return path.join(getChatSessionsDir(), `${id}.json`);
}

function getSessionIndexPath(): string {
  return path.join(getChatSessionsDir(), "index.json");
}

async function ensureChatSessionsDir(): Promise<void> {
  try {
    await fs.mkdir(getChatSessionsDir(), { recursive: true });
  } catch {
    // 이미 존재하는 경우 무시
  }
}

// ─── 인덱스 관리 ───

export async function loadSessionIndex(): Promise<ChatSessionIndex> {
  try {
    const data = await fs.readFile(getSessionIndexPath(), "utf-8");
    return JSON.parse(data) as ChatSessionIndex;
  } catch {
    return { sessions: [] };
  }
}

async function saveSessionIndex(index: ChatSessionIndex): Promise<void> {
  await ensureChatSessionsDir();
  await fs.writeFile(getSessionIndexPath(), JSON.stringify(index, null, 2));
}

// ─── 세션 CRUD ───

export async function loadSession(id: string): Promise<ChatSession | null> {
  try {
    const data = await fs.readFile(getSessionFilePath(id), "utf-8");
    return JSON.parse(data) as ChatSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: ChatSession): Promise<void> {
  await ensureChatSessionsDir();

  // 세션 파일 저장
  await fs.writeFile(
    getSessionFilePath(session.id),
    JSON.stringify(session, null, 2)
  );

  // index.json 동기화
  const index = await loadSessionIndex();
  const meta: ChatSessionMeta = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
  };

  const existingIndex = index.sessions.findIndex((s) => s.id === session.id);
  if (existingIndex >= 0) {
    index.sessions[existingIndex] = meta;
  } else {
    index.sessions.push(meta);
  }

  await saveSessionIndex(index);
}

export async function createSession(title?: string): Promise<ChatSession> {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: title ?? "새 대화",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  await saveSession(session);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  // 세션 파일 삭제
  try {
    await fs.unlink(getSessionFilePath(id));
  } catch {
    // 파일 없으면 무시
  }

  // index에서 제거
  const index = await loadSessionIndex();
  index.sessions = index.sessions.filter((s) => s.id !== id);
  await saveSessionIndex(index);
}

export async function listSessions(): Promise<ChatSessionMeta[]> {
  const index = await loadSessionIndex();
  // updatedAt 내림차순 정렬
  return index.sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ─── 메시지 관리 ───

export async function appendMessage(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) {
    throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
  }

  session.messages.push(message);
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
}

// ─── 제목 생성 ───

export function generateSessionTitle(content: string): string {
  // 첫 줄만 추출하고 30자로 잘라내기
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= 30) {
    return firstLine;
  }
  return firstLine.slice(0, 30) + "...";
}
