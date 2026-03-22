import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage, ChatSessionMeta, ToolInvocation } from "@/types";

interface UseChatOptions {
  /** Extra body fields to include in the /api/chat POST request */
  extraBody?: Record<string, unknown>;
  /** Called after a new session is auto-created in handleSendMessage */
  onSessionCreated?: () => void;
}

interface UseChatReturn {
  // State
  messages: ChatMessage[];
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  isSending: boolean;
  streamingMessageId: string | null;
  isPendingResponse: boolean;
  newlyArrivedMessageId: string | null;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  gcpConnected: boolean | null;
  aiModelId: string;
  aiModels: { id: string; label: string; description: string }[];
  currentModelLabel: string;

  // Setters
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessions: React.Dispatch<React.SetStateAction<ChatSessionMeta[]>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // Actions
  fetchSessions: () => Promise<void>;
  handleSelectSession: (sessionId: string) => Promise<void>;
  handleLoadMoreMessages: () => Promise<void>;
  handleSendMessage: (text: string) => Promise<void>;
  handleCreateSession: () => Promise<void>;
  handleDeleteSession: (id: string) => Promise<void>;
  handleRenameSession: (id: string, title: string) => Promise<void>;
  handleChangeModel: (modelId: string) => Promise<void>;
  handleEditUserMessage: (messageId: string, newContent: string) => Promise<void>;
  handleRegenerateResponse: () => Promise<void>;
}

const MESSAGE_PAGE_SIZE = 15;

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { extraBody, onSessionCreated } = options;

  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [gcpConnected, setGcpConnected] = useState<boolean | null>(null);
  const [aiModelId, setAiModelId] = useState<string>("");
  const [aiModels, setAiModels] = useState<{ id: string; label: string; description: string }[]>([]);

  const pendingMessageRef = useRef<string | null>(null);
  const [isPendingResponse, setIsPendingResponse] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [newlyArrivedMessageId, setNewlyArrivedMessageId] = useState<string | null>(null);

  // 페이지네이션 상태
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 메시지 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // extraBody를 ref로 관리하여 streamChat 내에서 최신 값 참조
  const extraBodyRef = useRef(extraBody);
  extraBodyRef.current = extraBody;

  // onSessionCreated를 ref로 관리
  const onSessionCreatedRef = useRef(onSessionCreated);
  onSessionCreatedRef.current = onSessionCreated;

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
    }
  }, []);

  // 세션 생성 후 대기 중인 메시지 전송
  useEffect(() => {
    if (activeSessionId && pendingMessageRef.current) {
      const text = pendingMessageRef.current;
      pendingMessageRef.current = null;
      saveUserMessage(activeSessionId, text);
      streamChat(activeSessionId, text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

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

        // 제목이 변경되었으면 해당 세션만 업데이트
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

          const lastMsg = session.messages[session.messages.length - 1];
          if (lastMsg?.role === "assistant") {
            setNewlyArrivedMessageId(lastMsg.id);
            setTimeout(() => setNewlyArrivedMessageId(null), 10000);
          }

          setMessages(session.messages);

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

    // 기존 폴링 정리
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPendingResponse(false);

    setActiveSessionId(id);
    // 페이지네이션 초기화
    setHasMoreMessages(false);
    setNextBefore(null);

    try {
      const res = await fetch(`/api/chat/sessions/${id}?limit=${MESSAGE_PAGE_SIZE}`);
      const data = await res.json();

      if (data.success) {
        const session = data.data;
        setMessages(session.messages);

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
    } catch {
      toast.error("대화를 불러올 수 없습니다");
    }
  }

  // 이전 메시지 더 로드
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
        setMessages((prev) => [...session.messages, ...prev]);

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
    } catch {
      toast.error("모델 변경에 실패했습니다");
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

  // SSE 스트리밍 채팅 함수
  async function streamChat(sessionId: string, text: string) {
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
    setStreamingMessageId(assistantMessageId);

    try {
      // UIMessage 형식으로 변환
      const uiMessages = messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      }));
      uiMessages.push({
        id: userMessage.id,
        role: "user",
        parts: [{ type: "text" as const, text }],
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: uiMessages,
          sessionId,
          ...extraBodyRef.current,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AI 응답 생성에 실패했습니다");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("스트림을 읽을 수 없습니다");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      const toolInvocationsMap = new Map<string, ToolInvocation>();
      const sources: { id: string; url: string; title: string }[] = [];

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

              case "source": {
                if (event.url) {
                  sources.push({
                    id: event.id || crypto.randomUUID(),
                    url: event.url,
                    title: event.title || "",
                  });
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

              default:
                break;
            }
          } catch {
            // JSON 파싱 실패 - 무시
          }
        }
      }

      // Grounding 출처를 assistant 메시지에 반영
      if (sources.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, sources } : m
          )
        );
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
        return;
      }
      console.error("[Chat] 스트리밍 실패:", err);
      toast.error((err as Error).message || "AI 응답 생성에 실패했습니다");
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
    } finally {
      setIsSending(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }

  // 사용자 메시지 수정
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
        const messagesWithoutLast = data.data.messages.slice(0, -1);
        setMessages(messagesWithoutLast);
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
      const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        const lastUserMessage = data.data.messages
          .filter((m: ChatMessage) => m.role === "user")
          .pop();

        const messagesWithoutLastUser = data.data.messages.slice(0, -1);
        setMessages(messagesWithoutLastUser);

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
        pendingMessageRef.current = text;
        setActiveSessionId(data.data.id);
        onSessionCreatedRef.current?.();
        return;
      } catch (err) {
        console.error("[Chat] 자동 세션 생성 실패:", err);
        toast.error("대화 생성에 실패했습니다");
        return;
      }
    }

    saveUserMessage(activeSessionId, text);
    streamChat(activeSessionId, text);
  }

  const currentModelLabel = aiModels.find((m) => m.id === aiModelId)?.label ?? aiModelId;

  return {
    // State
    messages,
    sessions,
    activeSessionId,
    isSending,
    streamingMessageId,
    isPendingResponse,
    newlyArrivedMessageId,
    hasMoreMessages,
    isLoadingMore,
    gcpConnected,
    aiModelId,
    aiModels,
    currentModelLabel,

    // Setters
    setActiveSessionId,
    setSessions,
    setMessages,

    // Actions
    fetchSessions,
    handleSelectSession,
    handleLoadMoreMessages,
    handleSendMessage,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
    handleChangeModel,
    handleEditUserMessage,
    handleRegenerateResponse,
  };
}
