"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { Ghost, X, Plus, Maximize2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import type { ChatMessage, ChatSessionMeta } from "@/types";

interface ChatOverlayProps {
  onClose: () => void;
}

export function ChatOverlay({ onClose }: ChatOverlayProps) {
  const router = useRouter();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [gcpConnected, setGcpConnected] = useState<boolean | null>(null);
  const [aiModelId, setAiModelId] = useState<string>("");
  const [aiModels, setAiModels] = useState<{ id: string; label: string; description: string }[]>([]);
  const pendingMessageRef = useRef<string | null>(null);
  const pendingRestoreRef = useRef<UIMessage[] | null>(null);
  const [isPendingResponse, setIsPendingResponse] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // 폴링으로 새로 도착한 메시지 ID (타이프라이터 효과용)
  const [newlyArrivedMessageId, setNewlyArrivedMessageId] = useState<string | null>(null);
  // 페이지네이션 상태
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGE_PAGE_SIZE = 15;

  // activeSessionId가 바뀔 때마다 transport를 재생성
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { sessionId: activeSessionId },
      }),
    [activeSessionId]
  );

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    stop,
    error,
  } = useChat({
    id: activeSessionId ? `overlay-${activeSessionId}` : undefined,
    transport,
    onFinish: async () => {
      // 스트리밍 완료 후 해당 세션 정보만 업데이트 (제목, 메시지 개수)
      if (!activeSessionId) return;
      try {
        const res = await fetch(`/api/chat/sessions/${activeSessionId}`);
        const data = await res.json();
        if (data.success) {
          const session = data.data;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    title: session.title,
                    messageCount: session.messages.length,
                    updatedAt: session.updatedAt,
                  }
                : s
            )
          );
        }
      } catch {
        // 무시
      }
    },
  });

  const isSending = status === "submitted" || status === "streaming";

  // 세션 목록 로드
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch {
      // 무시
    }
  }, []);

  // 세션 생성 후 대기 중인 메시지 전송 또는 복원 메시지 적용
  useEffect(() => {
    if (activeSessionId && pendingMessageRef.current) {
      const text = pendingMessageRef.current;
      pendingMessageRef.current = null;
      // 사용자 메시지 즉시 저장
      saveUserMessage(activeSessionId, text);
      sendMessage({ text });
    }
    if (activeSessionId && pendingRestoreRef.current) {
      const restored = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      setMessages(restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, sendMessage, setMessages]);

  // 에러 발생 시 토스트
  useEffect(() => {
    if (error) {
      toast.error(error.message || "AI 응답 생성에 실패했습니다");
    }
  }, [error]);

  // GCP 연동 상태 + AI 모델 설정 + 세션 목록 로드
  useEffect(() => {
    async function init() {
      try {
        const [gcpRes, modelRes] = await Promise.all([
          fetch("/api/settings/gcp"),
          fetch("/api/settings/ai-model"),
        ]);
        const gcpData = await gcpRes.json();
        setGcpConnected(gcpData.success && gcpData.data?.connected);

        const modelData = await modelRes.json();
        if (modelData.success) {
          setAiModelId(modelData.data.modelId);
          setAiModels(modelData.data.models);
        }
      } catch {
        setGcpConnected(false);
      }
    }
    init();
    fetchSessions();
  }, [fetchSessions]);

  // AI 모델 변경
  async function handleChangeModel(modelId: string) {
    try {
      const res = await fetch("/api/settings/ai-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (data.success) {
        setAiModelId(data.data.modelId);
        const model = aiModels.find((m) => m.id === modelId);
        toast.success(`모델: ${model?.label ?? modelId}`);
      }
    } catch {
      toast.error("모델 변경에 실패했습니다");
    }
  }

  // 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // 응답 대기 중인 세션 폴링
  async function pollForResponse(sid: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sid}`);
      const data = await res.json();

      if (data.success) {
        const session = data.data;

        // 제목이 변경되었으면 해당 세션만 업데이트 (전체 새로고침 없이)
        setSessions((prev) => {
          const existing = prev.find((s) => s.id === sid);
          if (existing && existing.title !== session.title) {
            return prev.map((s) =>
              s.id === sid ? { ...s, title: session.title } : s
            );
          }
          return prev;
        });

        // 응답이 완료되었으면 메시지 업데이트하고 폴링 중단
        if (!session.pendingResponse) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsPendingResponse(false);

          // 새로 도착한 assistant 메시지 ID 추적 (타이프라이터 효과용)
          const lastMsg = session.messages[session.messages.length - 1];
          if (lastMsg?.role === "assistant") {
            setNewlyArrivedMessageId(lastMsg.id);
            // 타이프라이터 완료 후 리셋 (약 10초 후)
            setTimeout(() => setNewlyArrivedMessageId(null), 10000);
          }

          // 메시지 업데이트
          const loaded = session.messages.map((m: ChatMessage) => ({
            id: m.id,
            role: m.role,
            parts: [{ type: "text" as const, text: m.content }],
          }));
          setMessages(loaded);

          // 메시지 개수 업데이트
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sid
                ? { ...s, messageCount: session.messages.length, updatedAt: session.updatedAt }
                : s
            )
          );
        }
      }
    } catch (err) {
      console.error("[ChatOverlay] 폴링 실패:", err);
    }
  }

  // 세션 선택 → 메시지 로드
  async function handleSelectSession(sessionId: string) {
    if (sessionId === activeSessionId) return;
    // 스트리밍 중이어도 서버는 계속 진행하므로 stop() 호출하지 않음
    // 서버에서 응답 완료 후 자동 저장됨

    // 기존 폴링 정리
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPendingResponse(false);
    // 페이지네이션 초기화
    setHasMoreMessages(false);
    setNextBefore(null);

    try {
      // 최근 메시지만 먼저 로드 (페이지네이션)
      const res = await fetch(`/api/chat/sessions/${sessionId}?limit=${MESSAGE_PAGE_SIZE}`);
      const data = await res.json();
      if (data.success) {
        const session = data.data;
        // 저장된 메시지를 useChat 형식으로 변환하여 ref에 저장
        pendingRestoreRef.current = session.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }) satisfies UIMessage);
        // activeSessionId 변경 → useChat 인스턴스 재생성 → useEffect에서 복원
        setActiveSessionId(sessionId);

        // 페이지네이션 정보 저장
        if (session.pagination) {
          setHasMoreMessages(session.pagination.hasMore);
          setNextBefore(session.pagination.nextBefore);
        }

        // 응답 대기 중이면 폴링 시작
        if (session.pendingResponse) {
          setIsPendingResponse(true);
          pollingRef.current = setInterval(() => pollForResponse(sessionId), 1500);
        }
      }
    } catch {
      toast.error("대화를 불러오지 못했습니다");
    }
  }

  // 이전 메시지 더 로드 (위쪽 무한스크롤)
  async function handleLoadMoreMessages() {
    if (!activeSessionId || !hasMoreMessages || isLoadingMore || nextBefore === null) return;

    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/chat/sessions/${activeSessionId}?limit=${MESSAGE_PAGE_SIZE}&before=${nextBefore}`
      );
      const data = await res.json();

      if (data.success) {
        const session = data.data;
        // 이전 메시지를 앞에 추가
        const olderMessages = session.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }));

        setMessages((prev) => [...olderMessages, ...prev]);

        // 페이지네이션 정보 업데이트
        if (session.pagination) {
          setHasMoreMessages(session.pagination.hasMore);
          setNextBefore(session.pagination.nextBefore);
        } else {
          setHasMoreMessages(false);
          setNextBefore(null);
        }
      }
    } catch (err) {
      console.error("[ChatOverlay] 이전 메시지 로드 실패:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // 사용자 메시지를 세션에 저장
  async function saveUserMessage(sessionId: string, text: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      // 제목이 변경되었으면 세션 목록 업데이트
      if (data.success && data.data.title) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, title: data.data.title } : s
          )
        );
      }
    } catch (err) {
      console.error("[ChatOverlay] 사용자 메시지 저장 실패:", err);
    }
  }

  // 사용자 메시지 수정 (이후 메시지 삭제 후 재생성)
  async function handleEditUserMessage(messageId: string, newContent: string) {
    if (!activeSessionId || isSending) return;

    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, content: newContent }),
      });
      const data = await res.json();

      if (data.success) {
        // 수정된 메시지 목록에서 마지막 사용자 메시지 제외 (sendMessage가 추가함)
        const messagesWithoutLast = data.data.messages.slice(0, -1);
        const loaded = messagesWithoutLast.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }));
        setMessages(loaded);
        // 새 응답 요청 (sendMessage가 사용자 메시지를 자동 추가)
        sendMessage({ text: newContent });
      } else {
        toast.error("메시지 수정에 실패했습니다");
      }
    } catch (err) {
      console.error("[ChatOverlay] 메시지 수정 실패:", err);
      toast.error("메시지 수정에 실패했습니다");
    }
  }

  // AI 응답 재생성
  async function handleRegenerateResponse() {
    if (!activeSessionId || isSending) return;

    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        // 마지막 사용자 메시지 찾기
        const lastUserMessage = data.data.messages
          .filter((m: ChatMessage) => m.role === "user")
          .pop();

        // 삭제 후 메시지 목록에서 마지막 사용자 메시지 제외 (sendMessage가 추가함)
        const messagesWithoutLastUser = data.data.messages.slice(0, -1);
        const loaded = messagesWithoutLastUser.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }));
        setMessages(loaded);

        // 마지막 사용자 메시지로 재생성 요청
        if (lastUserMessage) {
          sendMessage({ text: lastUserMessage.content });
        }
      } else {
        toast.error("응답 재생성에 실패했습니다");
      }
    } catch (err) {
      console.error("[ChatOverlay] 응답 재생성 실패:", err);
      toast.error("응답 재생성에 실패했습니다");
    }
  }

  // 메시지 전송 (세션이 없으면 자동 생성)
  async function handleSendMessage(text: string) {
    if (!text.trim() || isSending) return;

    if (!activeSessionId) {
      try {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();

        if (!data.success) {
          toast.error("대화 생성에 실패했습니다");
          return;
        }

        pendingMessageRef.current = text;
        setActiveSessionId(data.data.id);
        // 세션 목록 갱신
        fetchSessions();
        return;
      } catch {
        toast.error("대화 생성에 실패했습니다");
        return;
      }
    }

    // 사용자 메시지 즉시 저장
    saveUserMessage(activeSessionId, text);
    sendMessage({ text });
  }

  // 새 대화
  function handleNewChat() {
    // 스트리밍 중이어도 서버는 계속 진행하므로 stop() 호출하지 않음
    setActiveSessionId(null);
    setMessages([]);
  }

  // 전체 페이지로 이동
  function handleGoToFullPage() {
    onClose();
    const url = activeSessionId ? `/chat?sessionId=${activeSessionId}` : "/chat";
    router.push(url);
  }

  // useChat messages → ChatMessage 변환
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content:
      m.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "",
    createdAt: new Date().toISOString(),
  }));

  const isGcpNotConnected = gcpConnected === false;
  const currentModelLabel = aiModels.find((m) => m.id === aiModelId)?.label ?? aiModelId;
  const activeSessionTitle = sessions.find((s) => s.id === activeSessionId)?.title;

  return (
    <>
      {/* 모바일 백드롭 */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      <div className="fixed z-50 bottom-20 right-4 w-96 h-[600px] max-md:inset-x-4 max-md:bottom-4 max-md:top-auto max-md:w-auto max-md:h-[50vh] rounded-2xl shadow-2xl border bg-background flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <DropdownMenu modal={false} onOpenChange={(open) => { if (open) fetchSessions(); }}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
                <Ghost className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-semibold text-sm truncate max-w-[160px]">
                {activeSessionTitle ?? "Neuro"}
              </span>
              <ChevronDown className="shrink-0 h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem
              onClick={handleNewChat}
              className="cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              <span className="text-sm">새 대화</span>
            </DropdownMenuItem>
            {sessions.length > 0 && <DropdownMenuSeparator />}
            {sessions.map((session) => (
              <DropdownMenuItem
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className="cursor-pointer"
              >
                <span className="text-sm truncate">
                  {session.title}
                  {session.id === activeSessionId && (
                    <span className="ml-2 text-xs text-primary">✓</span>
                  )}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={handleNewChat}
            title="새 대화"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={handleGoToFullPage}
            title="전체 화면으로"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={onClose}
            title="닫기"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <ChatMessageList
          messages={chatMessages}
          isLoading={isSending || isPendingResponse}
          newlyArrivedMessageId={newlyArrivedMessageId}
          sessionId={activeSessionId}
          hasMoreMessages={hasMoreMessages}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMoreMessages}
          onEditUserMessage={handleEditUserMessage}
          onRegenerateResponse={handleRegenerateResponse}
        />

      {/* 모델 선택 + 입력 */}
      <div className="shrink-0">
        {aiModels.length > 0 && !isGcpNotConnected && (
          <div className="px-4 pt-2 pb-1 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {currentModelLabel}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {aiModels.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => handleChangeModel(model.id)}
                    className="cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {model.label}
                        {model.id === aiModelId && (
                          <span className="ml-2 text-xs text-primary">✓</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {model.description}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <ChatInput
          onSend={handleSendMessage}
          isLoading={isSending}
          disabled={isGcpNotConnected}
          disabledMessage={
            isGcpNotConnected
              ? "설정에서 GCP 서비스 어카운트를 연동해주세요."
              : undefined
          }
        />
      </div>
    </div>
    </>
  );
}
