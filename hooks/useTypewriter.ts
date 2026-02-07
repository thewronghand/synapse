"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseTypewriterOptions {
  /** 초당 출력할 단어 수 (기본: 30) */
  wordsPerSecond?: number;
  /** 스트리밍 중인지 여부 */
  isStreaming: boolean;
}

/**
 * 스트리밍 텍스트에 타이프라이터 효과를 적용하는 훅.
 * targetText가 빠르게 업데이트되더라도 일정 속도로 단어를 풀어줌.
 * 마운트 시점에 이미 있는 텍스트는 즉시 표시하고, 이후 추가되는 텍스트만 타이핑 효과 적용.
 */
export function useTypewriter(
  targetText: string,
  { wordsPerSecond = 30, isStreaming }: UseTypewriterOptions
) {
  const [displayedText, setDisplayedText] = useState("");
  const displayedLengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const wordAccumulatorRef = useRef(0);
  // 마운트 시점의 초기 텍스트 길이 저장 (이미 있던 텍스트는 즉시 표시)
  const initialLengthRef = useRef<number | null>(null);

  // 단어 경계를 찾는 함수 (공백, 줄바꿈 기준)
  const findNextWordEnd = useCallback((text: string, fromIndex: number): number => {
    if (fromIndex >= text.length) return text.length;

    // 현재 위치부터 다음 공백/줄바꿈까지 찾기
    let i = fromIndex;
    // 공백이 아닌 문자가 나올 때까지 이동
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }
    // 다음 공백까지 이동 (단어 끝)
    while (i < text.length && !/\s/.test(text[i])) {
      i++;
    }
    return i;
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      wordAccumulatorRef.current += (elapsed / 1000) * wordsPerSecond;
      const wordsToAdd = Math.floor(wordAccumulatorRef.current);

      if (wordsToAdd > 0) {
        wordAccumulatorRef.current -= wordsToAdd;
        lastTimeRef.current = timestamp;

        let newLength = displayedLengthRef.current;
        for (let i = 0; i < wordsToAdd && newLength < targetText.length; i++) {
          newLength = findNextWordEnd(targetText, newLength);
        }

        if (newLength !== displayedLengthRef.current) {
          displayedLengthRef.current = newLength;
          setDisplayedText(targetText.slice(0, newLength));
        }
      }

      // 아직 표시할 텍스트가 남아있으면 계속 애니메이션
      if (displayedLengthRef.current < targetText.length) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [targetText, wordsPerSecond, findNextWordEnd]
  );

  // 마운트 시점에 이미 있는 텍스트 처리
  // isStreaming이 true면 타이프라이터 효과 적용, false면 즉시 표시
  useEffect(() => {
    if (initialLengthRef.current === null) {
      initialLengthRef.current = targetText.length;
      // isStreaming이면 처음부터 타이핑 효과 적용 (폴링으로 새로 도착한 메시지)
      if (isStreaming) {
        displayedLengthRef.current = 0;
        setDisplayedText("");
      } else if (targetText.length > 0) {
        // 마운트 시점에 텍스트가 있으면 즉시 전체 표시 (기존 메시지)
        displayedLengthRef.current = targetText.length;
        setDisplayedText(targetText);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 초기화 전이면 무시
    if (initialLengthRef.current === null) return;

    // 타겟이 현재 표시된 것보다 길면 애니메이션 시작
    // 스트리밍 여부와 관계없이 남은 텍스트가 있으면 계속 타이핑
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
      initialLengthRef.current = null; // 다음 메시지를 위해 리셋
    }
  }, [targetText.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // 아직 표시할 텍스트가 남아있으면 타이핑 중
  const isTyping = displayedLengthRef.current < targetText.length;

  return { displayedText, isTyping };
}
