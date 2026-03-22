"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import { PublishedChatOverlay } from "@/components/chat/PublishedChatOverlay";
import { ChatFab } from "@/components/chat/ChatFab";
import { isPublishedMode } from "@/lib/env";

export interface DocumentContext {
  title: string;
  folder: string;
  content?: string;
  selectedText?: string;
}

interface ChatOverlayContextType {
  isOpen: boolean;
  toggle: () => void;
  documentContext: DocumentContext | null;
  setDocumentContext: (ctx: DocumentContext | null) => void;
  setSelectedText: (text: string) => void;
  // 선택 텍스트를 인용으로 Neuro 채팅에 보내기
  sendToNeuro: (text: string) => void;
  // 인용된 텍스트 (ChatOverlay 입력창 위에 표시)
  quotedText: string | null;
  clearQuotedText: () => void;
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
  const [quotedText, setQuotedText] = useState<string | null>(null);
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

  const sendToNeuro = useCallback((text: string) => {
    setSelectedText(text);
    setQuotedText(text);
    setIsOpen(true);
  }, [setSelectedText]);

  const clearQuotedText = useCallback(() => {
    setQuotedText(null);
  }, []);

  // /chat 페이지에서는 FAB 숨김
  const isChatPage = pathname === "/chat";
  const published = isPublishedMode();

  return (
    <ChatOverlayContext.Provider
      value={{
        isOpen,
        toggle,
        documentContext,
        setDocumentContext,
        setSelectedText,
        sendToNeuro,
        quotedText,
        clearQuotedText,
      }}
    >
      {children}
      {!isChatPage && <ChatFab onClick={toggle} />}
      <AnimatePresence>
        {isOpen && !isChatPage && (
          published
            ? <PublishedChatOverlay key="chat-overlay" onClose={close} />
            : <ChatOverlay key="chat-overlay" onClose={close} />
        )}
      </AnimatePresence>
    </ChatOverlayContext.Provider>
  );
}
