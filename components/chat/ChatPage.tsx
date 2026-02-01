"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Ghost, PanelLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AppHeader from "@/components/layout/AppHeader";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatSessionList } from "@/components/chat/ChatSessionList";
import type { ChatSessionMeta, ChatMessage } from "@/types";

export function ChatPage() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const initialSessionHandled = useRef(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [gcpConnected, setGcpConnected] = useState<boolean | null>(null);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const pendingMessageRef = useRef<string | null>(null);
  const [aiModelId, setAiModelId] = useState<string>("");
  const [aiModels, setAiModels] = useState<{ id: string; label: string; description: string }[]>([]);

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
    id: activeSessionId ?? undefined,
    transport,
    onFinish: () => {
      // 제목 변경 반영을 위해 세션 목록 새로고침
      fetchSessions();
    },
  });

  const isSending = status === "submitted" || status === "streaming";

  // 세션 생성 후 대기 중인 메시지 전송
  useEffect(() => {
    if (activeSessionId && pendingMessageRef.current) {
      const text = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage({ text });
    }
  }, [activeSessionId, sendMessage]);

  // 에러 발생 시 토스트
  useEffect(() => {
    if (error) {
      toast.error(error.message || "AI 응답 생성에 실패했습니다");
    }
  }, [error]);

  // GCP 연동 상태 확인
  useEffect(() => {
    async function checkGcp() {
      try {
        const res = await fetch("/api/settings/gcp");
        const data = await res.json();
        setGcpConnected(data.success && data.data?.connected);
      } catch {
        setGcpConnected(false);
      }
    }
    checkGcp();

    // AI 모델 설정 로드
    async function fetchAiModel() {
      try {
        const res = await fetch("/api/settings/ai-model");
        const data = await res.json();
        if (data.success) {
          setAiModelId(data.data.modelId);
          setAiModels(data.data.models);
        }
      } catch {
        // 무시 - 기본값 사용
      }
    }
    fetchAiModel();
  }, []);

  // 세션 목록 조회
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch (err) {
      console.error("[Chat] 세션 목록 조회 실패:", err);
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // URL 쿼리 파라미터로 전달된 세션 자동 선택
  useEffect(() => {
    if (initialSessionHandled.current || isSessionsLoading) return;
    const sessionId = searchParams.get("sessionId");
    if (sessionId && sessions.some((s) => s.id === sessionId)) {
      initialSessionHandled.current = true;
      handleSelectSession(sessionId);
    } else {
      initialSessionHandled.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionsLoading, sessions, searchParams]);

  // 세션 선택
  async function handleSelectSession(id: string) {
    if (id === activeSessionId) return;

    // 스트리밍 중이면 중단
    if (isSending) {
      stop();
    }

    setActiveSessionId(id);
    setIsSessionLoading(true);
    setMobileSessionsOpen(false);

    try {
      const res = await fetch(`/api/chat/sessions/${id}`);
      const data = await res.json();

      if (data.success) {
        // ChatMessage → useChat UIMessage 형식으로 변환
        const loaded = data.data.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
        }));
        setMessages(loaded);
      }
    } catch (err) {
      console.error("[Chat] 세션 로드 실패:", err);
      toast.error("대화를 불러올 수 없습니다");
    } finally {
      setIsSessionLoading(false);
    }
  }

  // 새 세션 생성
  async function handleCreateSession() {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.success) {
        setSessions((prev) => [
          {
            id: data.data.id,
            title: data.data.title,
            createdAt: data.data.createdAt,
            updatedAt: data.data.updatedAt,
            messageCount: 0,
          },
          ...prev,
        ]);
        setActiveSessionId(data.data.id);
        setMessages([]);
        setMobileSessionsOpen(false);
      }
    } catch (err) {
      console.error("[Chat] 세션 생성 실패:", err);
      toast.error("새 대화를 생성할 수 없습니다");
    }
  }

  // 세션 삭제
  async function handleDeleteSession(id: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([]);
        }
        toast.success("대화가 삭제되었습니다");
      }
    } catch (err) {
      console.error("[Chat] 세션 삭제 실패:", err);
      toast.error("대화를 삭제할 수 없습니다");
    }
  }

  // 세션 이름 수정
  async function handleRenameSession(id: string, title: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();

      if (data.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title } : s))
        );
      }
    } catch (err) {
      console.error("[Chat] 세션 이름 수정 실패:", err);
      toast.error("이름 수정에 실패했습니다");
    }
  }

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
    } catch (err) {
      console.error("[Chat] 모델 변경 실패:", err);
      toast.error("모델 변경에 실패했습니다");
    }
  }

  const currentModelLabel = aiModels.find((m) => m.id === aiModelId)?.label ?? aiModelId;

  // 메시지 전송 (세션이 없으면 자동 생성)
  async function handleSendMessage(text: string) {
    if (!text.trim() || isSending) return;

    // 세션이 없으면 자동 생성 후 pending으로 전송 예약
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

        setSessions((prev) => [
          {
            id: data.data.id,
            title: data.data.title,
            createdAt: data.data.createdAt,
            updatedAt: data.data.updatedAt,
            messageCount: 0,
          },
          ...prev,
        ]);
        // transport가 새 sessionId로 재생성된 뒤 전송되도록 예약
        pendingMessageRef.current = text;
        setActiveSessionId(data.data.id);
        return;
      } catch (err) {
        console.error("[Chat] 자동 세션 생성 실패:", err);
        toast.error("대화 생성에 실패했습니다");
        return;
      }
    }

    sendMessage({ text });
  }

  // useChat messages를 ChatMessage 형식으로 변환
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

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <div className="shrink-0 sticky top-0 z-10">
        <AppHeader
          showLogo
          subtitle="Neuro"
          actions={
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={handleCreateSession}
            >
              + 새 대화
            </Button>
          }
          mobileMenuItems={[
            {
              label: "새 대화",
              icon: <Ghost className="h-4 w-4" />,
              onClick: handleCreateSession,
            },
          ]}
        />
      </div>

      {/* 본문: 데스크톱 2단, 모바일 1단 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 세션 목록 (데스크톱) */}
        <aside className="hidden md:flex w-72 border-r flex-col shrink-0">
          {isSessionsLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            </div>
          ) : (
            <ChatSessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
              onCreate={handleCreateSession}
              onRename={handleRenameSession}
            />
          )}
        </aside>

        {/* 우측 채팅 영역 */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* 모바일 대화목록 버튼 (좌상단) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute top-2 left-2 z-10 h-8 w-8 cursor-pointer"
            onClick={() => setMobileSessionsOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          {isSessionLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                대화 불러오는 중...
              </p>
            </div>
          ) : (
            <ChatMessageList messages={chatMessages} isLoading={isSending} />
          )}
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
                  ? "설정 페이지에서 GCP 서비스 어카운트를 연동해주세요."
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* 모바일 세션 목록 (좌측 슬라이드) */}
      <Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>대화 목록</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ChatSessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
              onCreate={handleCreateSession}
              onRename={handleRenameSession}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
