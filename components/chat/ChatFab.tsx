"use client";

import { Ghost } from "lucide-react";

interface ChatFabProps {
  onClick: () => void;
}

export function ChatFab({ onClick }: ChatFabProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 -right-6 z-50 h-12 w-12 rounded-xl bg-[var(--primary-bg)] border border-primary/30 flex items-center justify-center hover:-translate-x-2 active:scale-95 transition-all duration-200 cursor-pointer group"
      aria-label="Neuro 채팅 열기"
    >
      <Ghost className="h-5 w-5 text-primary -translate-x-1.5 animate-neuro-tilt group-hover:animate-neuro-bounce" />
    </button>
  );
}
