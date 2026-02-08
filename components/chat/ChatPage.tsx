"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import type { ChatSessionMeta, ChatMessage, ToolInvocation } from "@/types";

export function ChatPage() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const initialSessionHandled = useRef(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [gcpConnected, setGcpConnected] = useState<boolean | null>(null);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

  // md 이상 화면에서는 모바일 세션 목록 자동 닫기
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && mobileSessionsOpen) {
        setMobileSessionsOpen(false);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mobileSessionsOpen]);
  const pendingMessageRef = useRef<string | null>(null);
  const [aiModelId, setAiModelId] = useState<string>("");
  const [aiModels, setAiModels] = useState<{ id: string; label: string; description: string }[]>([]);
  const [isPendingResponse, setIsPendingResponse] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // 폴링으로 새로 도착한 메시지 ID (타이프라이터 효과용)
  const [newlyArrivedMessageId, setNewlyArrivedMessageId] = useState<string | null>(null);
  // 페이지네이션 상태
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGE_PAGE_SIZE = 15;

  // 직접 관리하는 메시지 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  // 현재 스트리밍 중인 assistant 메시지 ID (바운스 로더 숨김용)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  // 스트리밍 중단용 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // 세션 생성 후 대기 중인 메시지 전송
  useEffect(() => {
    if (activeSessionId && pendingMessageRef.current) {
      const text = pendingMessageRef.current;
      pendingMessageRef.current = null;
      // 사용자 메시지 즉시 저장
      saveUserMessage(activeSessionId, text);
      streamChat(activeSessionId, text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

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
  async function pollForResponse(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      const data = await res.json();

      if (data.success) {
        const session = data.data;

        // 제목이 변경되었으면 해당 세션만 업데이트 (전체 새로고침 없이)
        setSessions((prev) => {
          const existing = prev.find((s) => s.id === sessionId);
          if (existing && existing.title !== session.title) {
            return prev.map((s) =>
              s.id === sessionId ? { ...s, title: session.title } : s
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
          setMessages(session.messages);

          // 메시지 개수 업데이트
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? { ...s, messageCount: session.messages.length, updatedAt: session.updatedAt }
                : s
            )
          );
        }
      }
    } catch (err) {
      console.error("[Chat] 폴링 실패:", err);
    }
  }

  // 세션 선택
  async function handleSelectSession(id: string) {
    if (id === activeSessionId) return;

    // 스트리밍 중이어도 서버는 계속 진행하므로 stop() 호출하지 않음
    // 서버에서 응답 완료 후 자동 저장됨

    // 기존 폴링 정리
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPendingResponse(false);

    setActiveSessionId(id);
    setIsSessionLoading(true);
    setMobileSessionsOpen(false);
    // 페이지네이션 초기화
    setHasMoreMessages(false);
    setNextBefore(null);

    try {
      // 최근 메시지만 먼저 로드 (페이지네이션)
      const res = await fetch(`/api/chat/sessions/${id}?limit=${MESSAGE_PAGE_SIZE}`);
      const data = await res.json();

      if (data.success) {
        const session = data.data;
        // ChatMessage 형식 그대로 사용
        setMessages(session.messages);

        // 페이지네이션 정보 저장
        if (session.pagination) {
          setHasMoreMessages(session.pagination.hasMore);
          setNextBefore(session.pagination.nextBefore);
        }

        // 응답 대기 중이면 폴링 시작
        if (session.pendingResponse) {
          setIsPendingResponse(true);
          pollingRef.current = setInterval(() => pollForResponse(id), 1500);
        }
      }
    } catch (err) {
      console.error("[Chat] 세션 로드 실패:", err);
      toast.error("대화를 불러올 수 없습니다");
    } finally {
      setIsSessionLoading(false);
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
        setMessages((prev) => [...session.messages, ...prev]);

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
      console.error("[Chat] 이전 메시지 로드 실패:", err);
    } finally {
      setIsLoadingMore(false);
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

  // SSE 스트리밍 채팅 함수
  async function streamChat(sessionId: string, text: string) {
    console.log("[ChatPage] streamChat 시작:", { sessionId, text });
    if (!text.trim()) return;

    // 기존 스트리밍 중단
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSending(true);

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // AI 응답 메시지 (빈 상태로 시작)
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      toolInvocations: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);
    // 스트리밍 시작 - 바운스 로더 대신 assistant 메시지 렌더링
    setStreamingMessageId(assistantMessageId);

    try {
      // UIMessage 형식으로 변환
      const uiMessages = messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      }));
      // 현재 사용자 메시지도 추가
      uiMessages.push({
        id: userMessage.id,
        role: "user",
        parts: [{ type: "text" as const, text }],
      });

      console.log("[ChatPage] fetch 시작...");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: uiMessages,
          sessionId,
        }),
        signal: abortController.signal,
      });

      console.log("[ChatPage] fetch 완료, status:", response.status);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AI 응답 생성에 실패했습니다");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("스트림을 읽을 수 없습니다");
      console.log("[ChatPage] reader 획득, 스트리밍 시작");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      const toolInvocationsMap = new Map<string, ToolInvocation>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            console.log("[ChatPage] SSE event:", event.type, event);

            switch (event.type) {
              case "text-delta": {
                fullText += event.delta || "";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: fullText }
                      : m
                  )
                );
                break;
              }

              case "tool-input-start": {
                console.log("[ChatPage] tool-input-start:", event);
                const invocation: ToolInvocation = {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  state: "input-streaming",
                };
                toolInvocationsMap.set(event.toolCallId, invocation);
                updateToolInvocations(assistantMessageId, toolInvocationsMap);
                break;
              }

              case "tool-input-available": {
                const existing = toolInvocationsMap.get(event.toolCallId);
                if (existing) {
                  existing.state = "input-available";
                  existing.input = event.input;
                  toolInvocationsMap.set(event.toolCallId, existing);
                  updateToolInvocations(assistantMessageId, toolInvocationsMap);
                }
                break;
              }

              case "tool-output-available": {
                const existing = toolInvocationsMap.get(event.toolCallId);
                if (existing) {
                  existing.state = "output-available";
                  existing.output = event.output;
                  toolInvocationsMap.set(event.toolCallId, existing);
                  updateToolInvocations(assistantMessageId, toolInvocationsMap);
                }
                break;
              }

              case "tool-output-error": {
                const existing = toolInvocationsMap.get(event.toolCallId);
                if (existing) {
                  existing.state = "output-error";
                  existing.errorText = event.errorText;
                  toolInvocationsMap.set(event.toolCallId, existing);
                  updateToolInvocations(assistantMessageId, toolInvocationsMap);
                }
                break;
              }

              // start, text-start, text-end, finish 등은 무시
              default:
                break;
            }
          } catch {
            // JSON 파싱 실패 - 무시
          }
        }
      }

      // 스트리밍 완료 후 세션 정보 업데이트
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`);
        const data = await res.json();
        if (data.success) {
          const session = data.data;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
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
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 사용자가 중단함
        return;
      }
      console.error("[Chat] 스트리밍 실패:", err);
      toast.error((err as Error).message || "AI 응답 생성에 실패했습니다");
      // 에러 시 빈 assistant 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
    } finally {
      setIsSending(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }

  // tool invocations 업데이트 헬퍼
  function updateToolInvocations(messageId: string, toolMap: Map<string, ToolInvocation>) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, toolInvocations: Array.from(toolMap.values()) }
          : m
      )
    );
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
      console.error("[Chat] 사용자 메시지 저장 실패:", err);
    }
  }

  // 사용자 메시지 수정 (이후 메시지 삭제 후 재생성)
  async function handleEditUserMessage(messageId: string, newContent: string) {
    if (!activeSessionId || isSending) return;

    try {
      // 메시지 수정 API 호출 (이후 메시지 삭제됨)
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, content: newContent }),
      });
      const data = await res.json();

      if (data.success) {
        // 수정된 메시지 목록에서 마지막 사용자 메시지 제외 (streamChat이 추가함)
        const messagesWithoutLast = data.data.messages.slice(0, -1);
        setMessages(messagesWithoutLast);

        // 새 응답 요청
        streamChat(activeSessionId, newContent);
      } else {
        toast.error("메시지 수정에 실패했습니다");
      }
    } catch (err) {
      console.error("[Chat] 메시지 수정 실패:", err);
      toast.error("메시지 수정에 실패했습니다");
    }
  }

  // AI 응답 재생성
  async function handleRegenerateResponse() {
    if (!activeSessionId || isSending) return;

    try {
      // 마지막 assistant 메시지 삭제
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        // 마지막 사용자 메시지 찾기
        const lastUserMessage = data.data.messages
          .filter((m: ChatMessage) => m.role === "user")
          .pop();

        // 삭제 후 메시지 목록에서 마지막 사용자 메시지 제외 (streamChat이 추가함)
        const messagesWithoutLastUser = data.data.messages.slice(0, -1);
        setMessages(messagesWithoutLastUser);

        // 마지막 사용자 메시지로 재생성 요청
        if (lastUserMessage) {
          streamChat(activeSessionId, lastUserMessage.content);
        }
      } else {
        toast.error("응답 재생성에 실패했습니다");
      }
    } catch (err) {
      console.error("[Chat] 응답 재생성 실패:", err);
      toast.error("응답 재생성에 실패했습니다");
    }
  }

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
        // useEffect에서 pendingMessageRef 감지 후 전송
        pendingMessageRef.current = text;
        setActiveSessionId(data.data.id);
        return;
      } catch (err) {
        console.error("[Chat] 자동 세션 생성 실패:", err);
        toast.error("대화 생성에 실패했습니다");
        return;
      }
    }

    // 사용자 메시지 즉시 저장
    saveUserMessage(activeSessionId, text);
    streamChat(activeSessionId, text);
  }

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
            <ChatMessageList
                messages={messages}
                isLoading={isSending || isPendingResponse}
                newlyArrivedMessageId={newlyArrivedMessageId}
                sessionId={activeSessionId}
                hasMoreMessages={hasMoreMessages}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMoreMessages}
                onEditUserMessage={handleEditUserMessage}
                onRegenerateResponse={handleRegenerateResponse}
                streamingMessageId={streamingMessageId}
              />
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
