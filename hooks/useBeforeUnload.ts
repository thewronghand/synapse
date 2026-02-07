"use client";

import { useEffect } from "react";

/**
 * 페이지 이탈 시 경고를 표시하는 훅
 * @param shouldWarn - true일 때만 경고 표시
 */
export function useBeforeUnload(shouldWarn: boolean) {
  useEffect(() => {
    if (!shouldWarn) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 최신 브라우저는 커스텀 메시지를 무시하고 기본 메시지를 표시함
      // 하지만 returnValue를 설정해야 경고가 표시됨
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldWarn]);
}
