"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Ghost, User, Pencil, RefreshCw, Check, X, Loader2, CheckCircle2, XCircle, FileText, FolderPlus, FolderMinus, FilePlus, FileEdit, Trash2, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage, ToolInvocation } from "@/types";

// Tool 이름을 한글로 매핑
const TOOL_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  "list-notes": { label: "문서 목록 조회", icon: <FileText className="w-3.5 h-3.5" /> },
  "read-note": { label: "문서 읽기", icon: <FileText className="w-3.5 h-3.5" /> },
  "create-note": { label: "문서 생성", icon: <FilePlus className="w-3.5 h-3.5" /> },
  "update-note": { label: "문서 수정", icon: <FileEdit className="w-3.5 h-3.5" /> },
  "delete-note": { label: "문서 삭제", icon: <Trash2 className="w-3.5 h-3.5" /> },
  "move-note": { label: "문서 이동", icon: <FolderInput className="w-3.5 h-3.5" /> },
  "list-folders": { label: "폴더 목록 조회", icon: <FolderPlus className="w-3.5 h-3.5" /> },
  "create-folder": { label: "폴더 생성", icon: <FolderPlus className="w-3.5 h-3.5" /> },
  "delete-folder": { label: "폴더 삭제", icon: <FolderMinus className="w-3.5 h-3.5" /> },
};

// Tool 실행 상태 UI 컴포넌트
function ToolInvocationItem({ invocation }: { invocation: ToolInvocation }) {
  const toolInfo = TOOL_LABELS[invocation.toolName] ?? {
    label: invocation.toolName,
    icon: <FileText className="w-3.5 h-3.5" />,
  };

  const isRunning = invocation.state === "input-streaming" || invocation.state === "input-available";
  const isComplete = invocation.state === "output-available";
  const isError = invocation.state === "output-error";

  // 실행 중일 때 표시할 상세 정보
  const getRunningDetail = () => {
    if (!invocation.input) return null;
    const input = invocation.input;
    if (input.title) return `"${input.title}"`;
    if (input.folder) return `폴더: ${input.folder}`;
    if (input.name) return `"${input.name}"`;
    return null;
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
      isRunning && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      isComplete && "bg-green-500/10 text-green-700 dark:text-green-400",
      isError && "bg-red-500/10 text-red-700 dark:text-red-400"
    )}>
      {/* 상태 아이콘 */}
      {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {isComplete && <CheckCircle2 className="w-3.5 h-3.5" />}
      {isError && <XCircle className="w-3.5 h-3.5" />}

      {/* Tool 아이콘 */}
      {toolInfo.icon}

      {/* Tool 이름 및 상태 */}
      <span className="font-medium">{toolInfo.label}</span>

      {/* 실행 중 상세 정보 */}
      {isRunning && getRunningDetail() && (
        <span className="text-muted-foreground">{getRunningDetail()}</span>
      )}

      {/* 에러 메시지 */}
      {isError && invocation.errorText && (
        <span className="text-red-600 dark:text-red-400">{invocation.errorText}</span>
      )}
    </div>
  );
}

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

  // 메시지 내용 그대로 표시 (스트리밍이 자연스러운 타이핑 효과를 제공)
  const renderedContent = message.content;

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
  const showRegenerateButton = isAssistant && isLastAssistantMessage && onRegenerateResponse && !isProcessing && !isStreaming;

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
            <div className="flex flex-col gap-2">
              {/* Tool 실행 상태 표시 */}
              {message.toolInvocations && message.toolInvocations.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-1">
                  {message.toolInvocations.map((invocation) => (
                    <ToolInvocationItem key={invocation.toolCallId} invocation={invocation} />
                  ))}
                </div>
              )}

              {/* 텍스트 콘텐츠 */}
              {renderedContent && (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {renderedContent}
                  </ReactMarkdown>
                </div>
              )}

              {/* 스트리밍 중이지만 아직 내용이 없을 때 스피너 표시 */}
              {isStreaming && !renderedContent && (!message.toolInvocations || message.toolInvocations.length === 0) && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}
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
