"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import { PublishedChatOverlay } from "@/components/chat/PublishedChatOverlay";
import { ChatFab } from "@/components/chat/ChatFab";
import { isPublishedMode } from "@/lib/env";

export interface DocumentContext {
  // 현재 보고 있는 문서 제목
  title: string;
  // 현재 보고 있는 문서 폴더
  folder: string;
  // 문서 내용 (앞부분만 포함 가능)
  content?: string;
  // 사용자가 드래그로 선택한 텍스트
  selectedText?: string;
}

interface ChatOverlayContextType {
  isOpen: boolean;
  toggle: () => void;
  documentContext: DocumentContext | null;
  setDocumentContext: (ctx: DocumentContext | null) => void;
  setSelectedText: (text: string) => void;
}

const ChatOverlayContext = createContext<ChatOverlayContextType | null>(null);

export function useChatOverlay() {
  const context = useContext(ChatOverlayContext);
  if (!context) {
    throw new Error("useChatOverlay must be used within ChatOverlayProvider");
  }
  return context;
}

interface ChatOverlayProviderProps {
  children: React.ReactNode;
}

export function ChatOverlayProvider({ children }: ChatOverlayProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [documentContext, setDocumentContext] = useState<DocumentContext | null>(null);
  const pathname = usePathname();

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setSelectedText = useCallback((text: string) => {
    setDocumentContext((prev) =>
      prev ? { ...prev, selectedText: text } : null
    );
  }, []);

  // /chat 페이지에서는 FAB 숨김
  const isChatPage = pathname === "/chat";
  const published = isPublishedMode();

  return (
    <ChatOverlayContext.Provider
      value={{ isOpen, toggle, documentContext, setDocumentContext, setSelectedText }}
    >
      {children}
      {!isChatPage && <ChatFab onClick={toggle} />}
      {isOpen && !isChatPage && (
        published
          ? <PublishedChatOverlay onClose={close} />
          : <ChatOverlay onClose={close} />
      )}
    </ChatOverlayContext.Provider>
  );
}
