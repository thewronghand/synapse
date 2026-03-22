"use client";

import { useState, useEffect, useRef } from "react";
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
import { useChat } from "@/hooks/useChat";

export function ChatPage() {
  const searchParams = useSearchParams();
  const chat = useChat();

  // UI 전용 상태
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const initialSessionHandled = useRef(false);

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

  // 세션 목록 로드 완료 감지
  useEffect(() => {
    if (chat.sessions.length > 0 || chat.gcpConnected !== null) {
      setIsSessionsLoading(false);
    }
  }, [chat.sessions, chat.gcpConnected]);

  // 최초 fetchSessions 완료 후 로딩 해제 (세션이 0개인 경우 대비)
  useEffect(() => {
    let cancelled = false;
    chat.fetchSessions().finally(() => {
      if (!cancelled) setIsSessionsLoading(false);
    });
    return () => { cancelled = true; };
    // 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL 쿼리 파라미터로 전달된 세션 자동 선택
  useEffect(() => {
    if (initialSessionHandled.current || isSessionsLoading) return;
    const sessionId = searchParams.get("sessionId");
    if (sessionId && chat.sessions.some((s) => s.id === sessionId)) {
      initialSessionHandled.current = true;
      handleSelectSessionWithLoading(sessionId);
    } else {
      initialSessionHandled.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionsLoading, chat.sessions, searchParams]);

  // 세션 선택 (UI 로딩 상태 포함)
  async function handleSelectSessionWithLoading(id: string) {
    setIsSessionLoading(true);
    setMobileSessionsOpen(false);
    await chat.handleSelectSession(id);
    setIsSessionLoading(false);
  }

  // 세션 생성 (모바일 메뉴 닫기 포함)
  async function handleCreateSessionWithUI() {
    await chat.handleCreateSession();
    setMobileSessionsOpen(false);
  }

  const isGcpNotConnected = chat.gcpConnected === false;

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
              onClick={handleCreateSessionWithUI}
            >
              + 새 대화
            </Button>
          }
          mobileMenuItems={[
            {
              label: "새 대화",
              icon: <Ghost className="h-4 w-4" />,
              onClick: handleCreateSessionWithUI,
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
              sessions={chat.sessions}
              activeSessionId={chat.activeSessionId}
              onSelect={handleSelectSessionWithLoading}
              onDelete={chat.handleDeleteSession}
              onCreate={handleCreateSessionWithUI}
              onRename={chat.handleRenameSession}
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
          )}
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
            <ChatInput
              onSend={chat.handleSendMessage}
              isLoading={chat.isSending}
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
              sessions={chat.sessions}
              activeSessionId={chat.activeSessionId}
              onSelect={handleSelectSessionWithLoading}
              onDelete={chat.handleDeleteSession}
              onCreate={handleCreateSessionWithUI}
              onRename={chat.handleRenameSession}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
