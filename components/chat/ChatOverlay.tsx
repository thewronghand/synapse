"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
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
  const pendingRestoreRef = useRef<unknown[] | null>(null);

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
      sendMessage({ text });
    }
    if (activeSessionId && pendingRestoreRef.current) {
      const restored = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      setMessages(restored);
    }
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

  // 세션 선택 → 메시지 로드
  async function handleSelectSession(sessionId: string) {
    if (sessionId === activeSessionId) return;
    if (isSending) stop();

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        // 저장된 메시지를 useChat 형식으로 변환하여 ref에 저장
        pendingRestoreRef.current = data.data.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text", text: m.content }],
          createdAt: new Date(m.createdAt),
        }));
        // activeSessionId 변경 → useChat 인스턴스 재생성 → useEffect에서 복원
        setActiveSessionId(sessionId);
      }
    } catch {
      toast.error("대화를 불러오지 못했습니다");
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

    sendMessage({ text });
  }

  // 새 대화
  function handleNewChat() {
    if (isSending) stop();
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
      <ChatMessageList messages={chatMessages} isLoading={isSending} />

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
