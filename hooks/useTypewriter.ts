"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseTypewriterOptions {
  /** 초당 출력할 글자 수 (기본: 40) */
  charsPerSecond?: number;
  /** 스트리밍 중인지 여부 */
  isStreaming: boolean;
}

/**
 * 스트리밍 텍스트에 타이프라이터 효과를 적용하는 훅.
 * targetText가 빠르게 업데이트되더라도 일정 속도로 글자를 풀어줌.
 * 스트리밍이 끝나면 남은 텍스트를 즉시 표시.
 */
export function useTypewriter(
  targetText: string,
  { charsPerSecond = 40, isStreaming }: UseTypewriterOptions
) {
  const [displayedText, setDisplayedText] = useState("");
  const displayedLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      const charsToAdd = Math.floor((elapsed / 1000) * charsPerSecond);

      if (charsToAdd > 0) {
        lastTimeRef.current = timestamp;
        const newLength = Math.min(
          displayedLengthRef.current + charsToAdd,
          targetText.length
        );

        if (newLength !== displayedLengthRef.current) {
          displayedLengthRef.current = newLength;
          setDisplayedText(targetText.slice(0, newLength));
        }
      }

      // 아직 표시할 글자가 남아있으면 계속 애니메이션
      if (displayedLengthRef.current < targetText.length) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [targetText, charsPerSecond]
  );

  useEffect(() => {
    // 스트리밍이 끝나면 남은 텍스트 즉시 표시
    if (!isStreaming) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      displayedLengthRef.current = targetText.length;
      setDisplayedText(targetText);
      lastTimeRef.current = null;
      return;
    }

    // 타겟이 현재 표시된 것보다 길면 애니메이션 시작
    if (displayedLengthRef.current < targetText.length) {
      if (!rafRef.current) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetText, isStreaming, animate]);

  // 완전히 새로운 메시지 시작 시 리셋
  useEffect(() => {
    if (targetText.length === 0) {
      displayedLengthRef.current = 0;
      setDisplayedText("");
      lastTimeRef.current = null;
    }
  }, [targetText.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTyping = isStreaming && displayedLengthRef.current < targetText.length;

  return { displayedText, isTyping };
}
