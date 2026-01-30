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
      onToggleFind: (callback: () => void) => void;
      removeToggleFind: () => void;
    };
  }
}

// 텍스트 노드 수집 (검색 대상)
function getTextNodes(root: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node as Text);
  }
  return nodes;
}

// 텍스트 노드 내에서 검색어 매칭 Range 생성
function findMatches(textNodes: Text[], query: string): Range[] {
  const ranges: Range[] = [];
  const lowerQuery = query.toLowerCase();

  for (const node of textNodes) {
    const text = (node.textContent || "").toLowerCase();
    let startIndex = 0;

    while (startIndex < text.length) {
      const matchIndex = text.indexOf(lowerQuery, startIndex);
      if (matchIndex === -1) break;

      const range = new Range();
      range.setStart(node, matchIndex);
      range.setEnd(node, matchIndex + query.length);
      ranges.push(range);
      startIndex = matchIndex + 1;
    }
  }

  return ranges;
}

// ::highlight() 스타일을 동적 주입 (Turbopack CSS 파서가 ::highlight를 지원하지 않음)
const HIGHLIGHT_STYLE_ID = "find-in-page-highlight-styles";

function injectHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    ::highlight(find-matches) {
      background-color: var(--find-match-bg);
      color: var(--find-match-fg);
    }
    ::highlight(find-current) {
      background-color: var(--find-current-bg);
      color: var(--find-current-fg);
    }
  `;
  document.head.appendChild(style);
}

export function FindInPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchRangesRef = useRef<Range[]>([]);
  const isElectron = typeof window !== "undefined" && !!window.electron;

  // DOM 하이라이트만 정리 (상태 변경 없음 - effect 안에서 안전하게 호출 가능)
  const clearDomHighlights = useCallback(() => {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete("find-matches");
      CSS.highlights.delete("find-current");
    }
    matchRangesRef.current = [];
  }, []);

  // 전체 정리 (상태 포함 - 이벤트 핸들러에서 호출)
  const clearHighlights = useCallback(() => {
    clearDomHighlights();
    setTotalMatches(0);
    setCurrentIndex(0);
  }, [clearDomHighlights]);

  // 검색 실행
  const performSearch = useCallback(
    (query: string) => {
      clearHighlights();
      injectHighlightStyles();
      if (!query || typeof CSS === "undefined" || !CSS.highlights) return;

      // <main> 태그 내부만 검색 (검색 입력창 제외)
      const contentArea = document.querySelector("main");
      if (!contentArea) return;

      const textNodes = getTextNodes(contentArea);
      const ranges = findMatches(textNodes, query);

      matchRangesRef.current = ranges;
      setTotalMatches(ranges.length);

      if (ranges.length > 0) {
        // 전체 매치 하이라이트
        const allHighlight = new Highlight(...ranges);
        CSS.highlights.set("find-matches", allHighlight);

        // 첫 번째 매치를 현재 매치로 표시
        setCurrentIndex(1);
        const currentHighlight = new Highlight(ranges[0]);
        CSS.highlights.set("find-current", currentHighlight);

        // 첫 번째 매치로 스크롤
        const firstRect = ranges[0].getBoundingClientRect();
        if (firstRect) {
          const elementAtRange = ranges[0].startContainer.parentElement;
          elementAtRange?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [clearHighlights]
  );

  // 다음 매치로 이동
  const goToMatch = useCallback(
    (index: number) => {
      const ranges = matchRangesRef.current;
      if (ranges.length === 0 || typeof CSS === "undefined" || !CSS.highlights)
        return;

      // 순환 인덱스
      let nextIndex = index;
      if (nextIndex > ranges.length) nextIndex = 1;
      if (nextIndex < 1) nextIndex = ranges.length;

      setCurrentIndex(nextIndex);

      // 현재 매치 하이라이트 업데이트
      const currentHighlight = new Highlight(ranges[nextIndex - 1]);
      CSS.highlights.set("find-current", currentHighlight);

      // 해당 매치로 스크롤
      const element = ranges[nextIndex - 1].startContainer.parentElement;
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    []
  );

  const handleNext = useCallback(() => {
    goToMatch(currentIndex + 1);
  }, [currentIndex, goToMatch]);

  const handlePrev = useCallback(() => {
    goToMatch(currentIndex - 1);
  }, [currentIndex, goToMatch]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchText("");
    clearHighlights();
  }, [clearHighlights]);

  const handleSearchInput = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  // 디바운싱: searchText 변경 후 300ms 뒤에 검색 실행
  useEffect(() => {
    if (!isOpen || !searchText) {
      clearDomHighlights();
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText, isOpen, performSearch, clearDomHighlights]);

  // Cmd+F 토글 리스너
  useEffect(() => {
    if (!isElectron) return;

    window.electron?.onToggleFind(() => {
      setIsOpen((prev) => {
        if (!prev) {
          setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          setSearchText("");
          clearHighlights();
        }
        return !prev;
      });
    });

    return () => {
      window.electron?.removeToggleFind();
    };
  }, [isElectron, clearHighlights]);

  // 검색창 열릴 때 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // 키보드 단축키
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
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
        onChange={(e) => handleSearchInput(e.target.value)}
        placeholder="검색..."
        className={cn(
          "w-48 px-2 py-1 text-sm",
          "bg-background border rounded",
          "focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
      />
      {searchText && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {totalMatches > 0
            ? `${currentIndex}/${totalMatches}`
            : "결과 없음"}
        </span>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrev}
          disabled={totalMatches === 0}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="이전 (Shift+Enter)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={totalMatches === 0}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
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
