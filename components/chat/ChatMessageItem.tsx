"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Ghost, User } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import type { ChatMessage } from "@/types";

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageItem({ message, isStreaming = false }: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // assistant 메시지에 타이프라이터 효과 적용
  const { displayedText } = useTypewriter(
    isAssistant ? message.content : "",
    { isStreaming, charsPerSecond: 60 }
  );

  const renderedContent = isAssistant && isStreaming ? displayedText : message.content;

  return (
    <div
      className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {/* AI 아이콘 (왼쪽) */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--primary-bg)] flex items-center justify-center mt-0.5">
          <Ghost className="w-4 h-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 max-w-[80%] break-words",
          isUser
            ? "bg-secondary/10 text-foreground"
            : "bg-primary/10 text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {renderedContent}
            </ReactMarkdown>
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
