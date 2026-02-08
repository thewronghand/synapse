"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NavigationGuardContextType {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  confirmNavigation: (onConfirm: () => void) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // 네비게이션 확인 요청
  const confirmNavigation = useCallback((onConfirm: () => void) => {
    if (isDirty) {
      setPendingNavigation(() => onConfirm);
      setShowDialog(true);
    } else {
      onConfirm();
    }
  }, [isDirty]);

  // 확인 후 이동
  const handleConfirm = useCallback(() => {
    setShowDialog(false);
    setIsDirty(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // 취소
  const handleCancel = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  // 브라우저 뒤로가기 막기 (popstate)
  useEffect(() => {
    if (!isDirty) return;

    // 현재 상태를 히스토리에 추가 (뒤로가기 방지용)
    const currentUrl = window.location.href;
    window.history.pushState({ navigationGuard: true }, "", currentUrl);

    const handlePopState = (e: PopStateEvent) => {
      // 뒤로가기 시도 시 다시 앞으로 가고 모달 표시
      window.history.pushState({ navigationGuard: true }, "", currentUrl);
      setPendingNavigation(() => () => {
        // 실제로 뒤로 가기
        window.history.go(-2);
      });
      setShowDialog(true);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  return (
    <NavigationGuardContext.Provider value={{ isDirty, setIsDirty, confirmNavigation }}>
      {children}

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항</AlertDialogTitle>
            <AlertDialogDescription>
              저장하지 않은 변경사항이 있습니다. 이 페이지를 떠나면 변경사항이 손실됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              저장하지 않고 나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error("useNavigationGuard must be used within NavigationGuardProvider");
  }
  return context;
}
