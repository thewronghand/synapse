"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

export function ChatInput({
  onSend,
  isLoading,
  disabled = false,
  disabledMessage,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // textarea 자동 높이 조절
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = newHeight + "px";
    // scrollHeight가 maxHeight를 넘을 때만 스크롤 허용
    textarea.style.overflowY = textarea.scrollHeight > 200 ? "auto" : "hidden";
  }, [input]);

  function handleSend() {
    if (!input.trim() || isLoading || disabled) return;
    onSend(input);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter = 전송, Shift+Enter = 줄바꿈
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 border-t bg-background p-4">
      {disabled && disabledMessage && (
        <p className="text-sm text-muted-foreground mb-2 text-center">
          {disabledMessage}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "채팅 사용 불가" : "메시지를 입력하세요..."}
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 resize-none overflow-hidden rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          type="button"
          size="icon"
          disabled={!input.trim() || isLoading || disabled}
          onClick={handleSend}
          className="shrink-0 h-10 w-10 rounded-xl cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
