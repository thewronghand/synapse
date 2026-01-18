"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    electron?: {
      platform: string;
      goBack: () => void;
      goForward: () => void;
      findInPage: (text: string) => void;
      findNext: () => void;
      findPrev: () => void;
      stopFind: () => void;
      onToggleFind: (callback: () => void) => void;
    };
  }
}

export function FindInPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isElectron = typeof window !== "undefined" && !!window.electron;

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchText("");
    if (isElectron) {
      window.electron?.stopFind();
    }
  }, [isElectron]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (isElectron && text) {
      window.electron?.findInPage(text);
    } else if (isElectron && !text) {
      window.electron?.stopFind();
    }
  }, [isElectron]);

  const handleNext = useCallback(() => {
    if (isElectron && searchText) {
      window.electron?.findInPage(searchText);
    }
  }, [isElectron, searchText]);

  const handlePrev = useCallback(() => {
    if (isElectron) {
      window.electron?.findPrev();
    }
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron) return;

    // Listen for toggle-find from main process (Cmd+F)
    window.electron?.onToggleFind(() => {
      setIsOpen((prev) => {
        if (!prev) {
          // Opening - focus input after state updates
          setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          // Closing
          window.electron?.stopFind();
          setSearchText("");
        }
        return !prev;
      });
    });
  }, [isElectron]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter") {
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, handleNext, handlePrev]);

  if (!isElectron || !isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50",
        "bg-card border rounded-lg p-2",
        "flex items-center gap-2",
        "animate-in slide-in-from-top-2 duration-200"
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={searchText}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="검색..."
        className={cn(
          "w-48 px-2 py-1 text-sm",
          "bg-background border rounded",
          "focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
      />
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrev}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="이전 (Shift+Enter)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="다음 (Enter)"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="닫기 (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
