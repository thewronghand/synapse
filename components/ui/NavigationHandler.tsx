"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Electron에서 Cmd+[/] (마우스 사이드 버튼 포함) → Next.js router.back()/forward() 연동
export function NavigationHandler() {
  const router = useRouter();
  const isElectron = typeof window !== "undefined" && !!window.electron;

  useEffect(() => {
    if (!isElectron) return;

    window.electron?.onNavBack(() => {
      router.back();
    });

    window.electron?.onNavForward(() => {
      router.forward();
    });

    return () => {
      window.electron?.removeNavListeners();
    };
  }, [isElectron, router]);

  return null;
}
