"use client";

import { motion } from "motion/react";
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
import { useChatOverlay } from "@/components/chat/ChatOverlayProvider";
import { useChat } from "@/hooks/useChat";

interface ChatOverlayProps {
  onClose: () => void;
}

export function ChatOverlay({ onClose }: ChatOverlayProps) {
  const router = useRouter();
  const { documentContext, quotedText, clearQuotedText } = useChatOverlay();
  const chat = useChat({
    extraBody: documentContext ? { documentContext } : undefined,
  });

  // 새 대화
  function handleNewChat() {
    chat.setActiveSessionId(null);
    chat.setMessages([]);
  }

  // 전체 페이지로 이동
  function handleGoToFullPage() {
    onClose();
    const url = chat.activeSessionId ? `/chat?sessionId=${chat.activeSessionId}` : "/chat";
    router.push(url);
  }

  const isGcpNotConnected = chat.gcpConnected === false;
  const activeSessionTitle = chat.sessions.find((s) => s.id === chat.activeSessionId)?.title;

  return (
    <>
      {/* 모바일 백드롭 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        className="fixed z-50 bottom-20 right-4 w-96 h-[600px] max-md:inset-x-4 max-md:bottom-4 max-md:top-auto max-md:w-auto max-md:h-[50vh] rounded-2xl shadow-2xl border bg-background flex flex-col overflow-hidden"
      >
      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <DropdownMenu modal={false} onOpenChange={(open) => { if (open) chat.fetchSessions(); }}>
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
            {chat.sessions.length > 0 && <DropdownMenuSeparator />}
            {chat.sessions.map((session) => (
              <DropdownMenuItem
                key={session.id}
                onClick={() => chat.handleSelectSession(session.id)}
                className="cursor-pointer"
              >
                <span className="text-sm truncate">
                  {session.title}
                  {session.id === chat.activeSessionId && (
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
          messages={chat.messages}
          isLoading={chat.isSending || chat.isPendingResponse}
          newlyArrivedMessageId={chat.newlyArrivedMessageId}
          sessionId={chat.activeSessionId}
          hasMoreMessages={chat.hasMoreMessages}
          isLoadingMore={chat.isLoadingMore}
          onLoadMore={chat.handleLoadMoreMessages}
          onEditUserMessage={chat.handleEditUserMessage}
          onRegenerateResponse={chat.handleRegenerateResponse}
          streamingMessageId={chat.streamingMessageId}
        />

      {/* 모델 선택 + 입력 */}
      <div className="shrink-0">
        {chat.aiModels.length > 0 && !isGcpNotConnected && (
          <div className="px-4 pt-2 pb-1 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {chat.currentModelLabel}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {chat.aiModels.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => chat.handleChangeModel(model.id)}
                    className="cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {model.label}
                        {model.id === chat.aiModelId && (
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
        {/* 인용된 텍스트 블록 */}
        {quotedText && (
          <div className="mx-3 mb-1 rounded-md border-l-2 border-primary/50 bg-muted/50 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">인용된 텍스트</span>
              <button
                onClick={clearQuotedText}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="max-h-20 overflow-y-auto text-xs text-muted-foreground italic whitespace-pre-wrap">
              {quotedText}
            </div>
            {quotedText.length > 2000 && (
              <p className="text-[10px] text-amber-500 mt-1">
                긴 텍스트는 2,000자까지만 전송됩니다
              </p>
            )}
          </div>
        )}
        <ChatInput
          onSend={(text) => {
            if (quotedText) {
              const trimmed = quotedText.slice(0, 2000);
              chat.handleSendMessage(`[인용: "${trimmed}"]\n\n${text}`);
              clearQuotedText();
            } else {
              chat.handleSendMessage(text);
            }
          }}
          isLoading={chat.isSending}
          disabled={isGcpNotConnected}
          disabledMessage={
            isGcpNotConnected
              ? "설정에서 GCP 서비스 어카운트를 연동해주세요."
              : undefined
          }
        />
      </div>
    </motion.div>
    </>
  );
}
