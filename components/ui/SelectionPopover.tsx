"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot } from "lucide-react";
import { useChatOverlay } from "@/components/chat/ChatOverlayProvider";

/**
 * 텍스트 선택 시 마우스 위치에 "뉴로에게 보내기" 팝오버 표시
 */
export function SelectionPopover() {
  const { sendToNeuro } = useChatOverlay();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");

  const handleMouseUp = useCallback(() => {
    // 약간의 딜레이로 선택이 확정된 후 처리
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";

      if (text.length > 2) {
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
          });
          setSelectedText(text);
        }
      } else {
        setPosition(null);
        setSelectedText("");
      }
    }, 10);
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // 팝오버 자체를 클릭한 게 아니면 닫기
    const target = e.target as HTMLElement;
    if (!target.closest("[data-selection-popover]")) {
      setPosition(null);
      setSelectedText("");
    }
  }, []);

  const handleScroll = useCallback(() => {
    setPosition(null);
    setSelectedText("");
  }, []);

  useEffect(() => {
    globalThis.document?.addEventListener("mouseup", handleMouseUp);
    globalThis.document?.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      globalThis.document?.removeEventListener("mouseup", handleMouseUp);
      globalThis.document?.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [handleMouseUp, handleMouseDown, handleScroll]);

  if (!position || !selectedText) return null;

  return (
    <div
      data-selection-popover
      className="fixed z-50 -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => {
          sendToNeuro(selectedText);
          setPosition(null);
          setSelectedText("");
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary/90 transition-colors cursor-pointer"
      >
        <Bot className="w-3.5 h-3.5" />
        뉴로에게 보내기
      </button>
    </div>
  );
}
