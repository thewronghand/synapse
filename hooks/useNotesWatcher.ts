"use client";

import { useEffect, useCallback, useRef } from "react";
import type { NotesChangedEvent } from "@/types";

// 전역 이벤트 브로드캐스터 - Electron IPC → CustomEvent로 변환
// 한 번만 등록되어 여러 컴포넌트가 동시에 수신 가능
let globalListenerInitialized = false;

function initGlobalNotesListener() {
  if (globalListenerInitialized) return;
  if (typeof window === "undefined" || !window.electron) return;

  console.log("[NotesWatcher] Initializing global listener");
  globalListenerInitialized = true;

  window.electron.onNotesChanged((data: NotesChangedEvent) => {
    console.log("[NotesWatcher] Broadcasting event:", data.event);
    // CustomEvent로 모든 구독자에게 브로드캐스트
    window.dispatchEvent(new CustomEvent("synapse-notes-changed", { detail: data }));
  });
}

interface UseNotesWatcherOptions {
  /** 변경 감지 시 호출될 콜백 */
  onNotesChanged?: (event: NotesChangedEvent) => void;
  /** 디바운스 시간 (ms) - 여러 변경이 빠르게 발생할 때 마지막 것만 처리 */
  debounceMs?: number;
  /** 활성화 여부 */
  enabled?: boolean;
}

/**
 * 노트 폴더 변경 감지 훅
 * Electron 환경에서만 동작 (파일 와처 기반)
 * 여러 컴포넌트에서 동시에 사용 가능 (전역 이벤트 브로드캐스터 패턴)
 */
export function useNotesWatcher(options: UseNotesWatcherOptions = {}) {
  const { onNotesChanged, debounceMs = 300, enabled = true } = options;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(onNotesChanged);

  // 콜백 레퍼런스 업데이트 (의존성 배열 문제 방지)
  useEffect(() => {
    callbackRef.current = onNotesChanged;
  }, [onNotesChanged]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    // 전역 리스너 초기화 (한 번만)
    initGlobalNotesListener();

    // CustomEvent 구독
    const handleEvent = (e: Event) => {
      const data = (e as CustomEvent<NotesChangedEvent>).detail;

      // 디바운스 처리
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        callbackRef.current?.(data);
        debounceRef.current = null;
      }, debounceMs);
    };

    window.addEventListener("synapse-notes-changed", handleEvent);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      window.removeEventListener("synapse-notes-changed", handleEvent);
    };
  }, [enabled, debounceMs]);
}

/**
 * 노트 변경 시 자동 새로고침 훅
 * fetchFn을 전달하면 변경 감지 시 자동으로 호출
 */
export function useNotesAutoRefresh(fetchFn: () => void | Promise<void>) {
  const handleNotesChanged = useCallback(() => {
    fetchFn();
  }, [fetchFn]);

  useNotesWatcher({
    onNotesChanged: handleNotesChanged,
    enabled: true,
  });
}
