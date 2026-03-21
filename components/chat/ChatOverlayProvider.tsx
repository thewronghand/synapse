"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import { PublishedChatOverlay } from "@/components/chat/PublishedChatOverlay";
import { ChatFab } from "@/components/chat/ChatFab";
import { isPublishedMode } from "@/lib/env";

interface ChatOverlayContextType {
  isOpen: boolean;
  toggle: () => void;
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
  const pathname = usePathname();

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // /chat 페이지에서는 FAB 숨김
  const isChatPage = pathname === "/chat";
  const published = isPublishedMode();

  return (
    <ChatOverlayContext.Provider value={{ isOpen, toggle }}>
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
