"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Ghost, User, Pencil, RefreshCw, Check, X } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types";

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  /** 마지막 사용자 메시지인지 (수정 가능 여부) */
  isLastUserMessage?: boolean;
  /** 마지막 assistant 메시지인지 (재생성 가능 여부) */
  isLastAssistantMessage?: boolean;
  /** 사용자 메시지 수정 시 호출 */
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  /** AI 응답 재생성 시 호출 */
  onRegenerateResponse?: () => void;
  /** 현재 로딩/스트리밍 중인지 (버튼 비활성화용) */
  isProcessing?: boolean;
}

export function ChatMessageItem({
  message,
  isStreaming = false,
  isLastUserMessage = false,
  isLastAssistantMessage = false,
  onEditUserMessage,
  onRegenerateResponse,
  isProcessing = false,
}: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // assistant 메시지에 타이프라이터 효과 적용 (단어 단위)
  const { displayedText, isTyping } = useTypewriter(
    isAssistant ? message.content : "",
    { isStreaming, wordsPerSecond: 30 }
  );

  // 타이핑 중이거나 스트리밍 중이면 displayedText 사용
  const renderedContent = isAssistant && (isStreaming || isTyping) ? displayedText : message.content;

  // 편집 모드 진입 시 textarea 포커스 및 높이 조절
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  function handleStartEdit() {
    setEditContent(message.content);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditContent(message.content);
  }

  function handleConfirmEdit() {
    if (editContent.trim() && editContent !== message.content && onEditUserMessage) {
      onEditUserMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  }

  // 수정/재생성 버튼 표시 조건
  const showEditButton = isUser && isLastUserMessage && onEditUserMessage && !isProcessing;
  const showRegenerateButton = isAssistant && isLastAssistantMessage && onRegenerateResponse && !isProcessing && !isStreaming && !isTyping;

  return (
    <div
      className={cn("group flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {/* AI 아이콘 (왼쪽) */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--primary-bg)] flex items-center justify-center mt-0.5">
          <Ghost className="w-4 h-4 text-primary" />
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 break-words",
            isUser
              ? "bg-secondary/10 text-foreground"
              : "bg-primary/10 text-foreground"
          )}
        >
          {isUser ? (
            isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full min-w-[200px] bg-transparent border-none outline-none resize-none text-sm"
                  rows={1}
                />
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer"
                    onClick={handleConfirmEdit}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            )
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {renderedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* 액션 버튼들 */}
        {!isEditing && (showEditButton || showRegenerateButton) && (
          <div className={cn(
            "flex gap-1 transition-opacity",
            isUser ? "justify-end" : "justify-start",
            "opacity-0 group-hover:opacity-100"
          )}>
            {showEditButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleStartEdit}
              >
                <Pencil className="h-3 w-3 mr-1" />
                수정
              </Button>
            )}
            {showRegenerateButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={onRegenerateResponse}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                재생성
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 사용자 아이콘 (오른쪽) */}
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-secondary/20 flex items-center justify-center mt-0.5">
          <User className="w-4 h-4 text-secondary" />
        </div>
      )}
    </div>
  );
}
