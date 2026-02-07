"use client";

import { useEffect, useRef } from "react";
import { Ghost } from "lucide-react";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import type { ChatMessage } from "@/types";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  /** 폴링으로 새로 도착한 메시지 ID (타이프라이터 효과용) */
  newlyArrivedMessageId?: string | null;
  /** 현재 세션 ID (세션 전환 시 스크롤 초기화용) */
  sessionId?: string | null;
  /** 이전 메시지가 더 있는지 여부 */
  hasMoreMessages?: boolean;
  /** 이전 메시지 로딩 중 여부 */
  isLoadingMore?: boolean;
  /** 이전 메시지 로드 함수 */
  onLoadMore?: () => void;
  /** 사용자 메시지 수정 시 호출 */
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  /** AI 응답 재생성 시 호출 */
  onRegenerateResponse?: () => void;
  /** 현재 스트리밍 중인 메시지 ID (바운스 로더 대신 빈 메시지 렌더링용) */
  streamingMessageId?: string | null;
}

export function ChatMessageList({
  messages,
  isLoading,
  newlyArrivedMessageId,
  sessionId,
  hasMoreMessages = false,
  isLoadingMore = false,
  onLoadMore,
  onEditUserMessage,
  onRegenerateResponse,
  streamingMessageId,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const prevSessionIdRef = useRef<string | null | undefined>(undefined);
  const prevScrollHeightRef = useRef<number>(0);
  // 세션 전환 시 무한스크롤 비활성화 (초기 스크롤 완료 전까지)
  const isInitialScrollRef = useRef(false);

  // 스크롤 위치 감지: 하단 근처이면 자동 스크롤, 상단 근처이면 이전 메시지 로드
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;

    const threshold = 100;
    shouldAutoScrollRef.current =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;

    // 초기 스크롤 중에는 무한스크롤 비활성화
    if (isInitialScrollRef.current) return;

    // 상단 근처에서 이전 메시지 로드
    if (el.scrollTop < 50 && hasMoreMessages && !isLoadingMore && onLoadMore) {
      prevScrollHeightRef.current = el.scrollHeight;
      onLoadMore();
    }
  }

  // 이전 메시지 로드 후 스크롤 위치 유지
  useEffect(() => {
    if (!isLoadingMore && prevScrollHeightRef.current > 0 && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      if (scrollDiff > 0) {
        scrollRef.current.scrollTop = scrollDiff;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [isLoadingMore, messages]);

  // 세션이 바뀌면 맨 아래로 스크롤하고, 초기 스크롤 동안 무한스크롤 비활성화
  useEffect(() => {
    const isSessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    if (isSessionChanged && sessionId && messages.length > 0 && scrollRef.current) {
      const scrollContainer = scrollRef.current;
      // 무한스크롤 비활성화
      isInitialScrollRef.current = true;

      // requestAnimationFrame으로 렌더링 완료 후 스크롤
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          shouldAutoScrollRef.current = true;
          // 스크롤 완료 후 무한스크롤 활성화
          setTimeout(() => {
            isInitialScrollRef.current = false;
          }, 300);
        });
      });
    }
  }, [sessionId, messages]);

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return <ChatEmptyState />;
  }

  const lastMessage = messages[messages.length - 1];
  const isLastAssistantStreaming =
    isLoading && lastMessage?.role === "assistant";
  // 전송 후 아직 assistant 메시지가 시작되지 않았거나, assistant 메시지가 비어있을 때 바운스 표시
  // 단, tool invocation이 있거나, streamingMessageId가 설정되어 있으면 바운스 숨김
  const lastAssistantContent = lastMessage?.role === "assistant" ? lastMessage.content : "";
  const lastAssistantHasTools = lastMessage?.role === "assistant" && lastMessage.toolInvocations && lastMessage.toolInvocations.length > 0;
  // streamingMessageId가 있으면 스트리밍 중이므로 바운스 대신 메시지 렌더링
  const isStreamingInProgress = !!streamingMessageId;
  const showBounceLoader =
    isLoading && !isStreamingInProgress && (!lastMessage || lastMessage.role !== "assistant" || (!lastAssistantContent.trim() && !lastAssistantHasTools));

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {/* 이전 메시지 로딩 인디케이터 */}
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      {messages.map((message, index) => {
        // 스트리밍 중 빈 assistant 메시지는 렌더링하지 않음 (bounce loader가 대신 표시됨)
        // 단, tool invocation이 있거나, streamingMessageId와 일치하면 렌더링
        const hasToolInvocations = message.toolInvocations && message.toolInvocations.length > 0;
        const isCurrentlyStreaming = message.id === streamingMessageId;
        const isEmptyAssistant =
          message.role === "assistant" && !message.content.trim() && !hasToolInvocations;
        // 스트리밍 중인 메시지는 빈 상태여도 렌더링 (스피너 표시)
        if (isEmptyAssistant && isLoading && !isCurrentlyStreaming) {
          return null;
        }

        // 폴링으로 새로 도착한 메시지인지 체크
        const isNewlyArrived = message.id === newlyArrivedMessageId;

        // 마지막 사용자/assistant 메시지 여부 확인
        const isLastUserMessage =
          message.role === "user" &&
          // 뒤에 사용자 메시지가 없어야 함
          !messages.slice(index + 1).some((m) => m.role === "user");
        const isLastAssistantMessage =
          message.role === "assistant" &&
          index === messages.length - 1;

        return (
          <ChatMessageItem
            key={message.id}
            message={message}
            isStreaming={
              (isLastAssistantStreaming && index === messages.length - 1) || isNewlyArrived
            }
            isLastUserMessage={isLastUserMessage}
            isLastAssistantMessage={isLastAssistantMessage}
            onEditUserMessage={onEditUserMessage}
            onRegenerateResponse={onRegenerateResponse}
            isProcessing={isLoading}
          />
        );
      })}

      {/* 전송 후 응답 대기 중 로딩 인디케이터 */}
      {showBounceLoader && (
        <div className="flex justify-start gap-2.5">
          <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--primary-bg)] flex items-center justify-center mt-0.5">
            <Ghost className="w-4 h-4 text-primary" />
          </div>
          <div className="bg-primary/10 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
