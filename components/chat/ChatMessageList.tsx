"use client";

import { useEffect, useRef } from "react";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import type { ChatMessage } from "@/types";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // 스크롤 위치 감지: 하단 근처이면 자동 스크롤
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 100;
    shouldAutoScrollRef.current =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }

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
  // 전송 후 아직 assistant 메시지가 시작되지 않았을 때만 바운스 표시
  const showBounceLoader =
    isLoading && (!lastMessage || lastMessage.role !== "assistant");

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.map((message, index) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          isStreaming={
            isLastAssistantStreaming && index === messages.length - 1
          }
        />
      ))}

      {/* 전송 후 응답 대기 중 로딩 인디케이터 */}
      {showBounceLoader && (
        <div className="flex justify-start">
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
