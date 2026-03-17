"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { RecordingOverlay } from "@/components/voice-memo/RecordingOverlay";
import { FolderSelectDialog } from "@/components/voice-memo/FolderSelectDialog";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";

// --- 상수 ---

// 전사 API 제한 (60분) 전에 자동 정지
const AUTO_STOP_SECONDS = 59 * 60 + 50; // 59분 50초
// 경고 표시 시작 시점
const WARNING_SECONDS = 58 * 60; // 58분

// --- Context 타입 ---

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  selectedFolder: string | null;
  autoStopped: boolean; // 자동 정지 여부
}

interface RecordingContextType {
  state: RecordingState;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  continueRecording: () => void;
  dismissAutoStop: () => void;
}

const RecordingContext = createContext<RecordingContextType | null>(null);

export function useRecording() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error("useRecording must be used within a RecordingProvider");
  }
  return context;
}

// --- Provider ---

interface RecordingProviderProps {
  children: ReactNode;
}

export function RecordingProvider({ children }: RecordingProviderProps) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    selectedFolder: null,
    autoStopped: false,
  });

  const [showFolderDialog, setShowFolderDialog] = useState(false);

  // 제목 및 파트 관리
  const customTitleRef = useRef<string | null>(null);
  const recordingPartRef = useRef(1);
  const lastFolderRef = useRef<string | null>(null);

  // 녹음 중일 때 페이지 이탈 경고
  useBeforeUnload(state.isRecording);

  // MediaRecorder 관련 refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);

  // 오디오 분석용 (웨이브폼 시각화)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 타이머 정리
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 스트림 및 AudioContext 정리
  const cleanupStream = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearTimer();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
    };
  }, [clearTimer, cleanupStream]);

  // 녹음 시작 요청 (폴더 선택 다이얼로그 표시)
  const startRecording = useCallback(() => {
    if (state.isRecording) return;
    setShowFolderDialog(true);
  }, [state.isRecording]);

  // 파일명 생성 헬퍼
  const generateFilename = useCallback(() => {
    const title = customTitleRef.current;
    const part = recordingPartRef.current;
    const suffix = part > 1 ? `-${part}` : "";

    if (title) {
      // 파일명 안전 문자로 변환
      const safe = title.replace(/[<>:"/\\|?*]/g, "_").trim();
      return `${safe}${suffix}.webm`;
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    return `recording-${timestamp}${suffix}.webm`;
  }, []);

  // 자동 정지 여부 추적용 ref
  const autoStoppedRef = useRef(false);

  // 실제 녹음 시작 (폴더 선택 후 또는 이어서 녹음 시)
  const startRecordingInternal = useCallback(async (folder: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 오디오 분석 노드 연결 (웨이브폼 시각화용)
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // 브라우저 지원 mimeType 확인
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        clearTimer();
        cleanupStream();

        // 녹음 데이터가 없으면 취소 처리 (cancelRecording에서 호출된 경우)
        if (chunksRef.current.length === 0) {
          setState({
            isRecording: false,
            isPaused: false,
            duration: 0,
            selectedFolder: null,
            autoStopped: false,
          });
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const filename = generateFilename();
        const file = new File([blob], filename, { type: mimeType });
        const currentDuration = durationRef.current;
        const wasAutoStopped = autoStoppedRef.current;
        autoStoppedRef.current = false;

        // 서버에 업로드
        try {
          const formData = new FormData();
          formData.append("audio", file);

          const uploadRes = await fetch(
            `/api/upload/audio?folder=${encodeURIComponent(folder)}`,
            { method: "POST", body: formData }
          );
          const uploadData = await uploadRes.json();

          if (!uploadData.success) {
            throw new Error(uploadData.error || "업로드 실패");
          }

          // 음성 메모 메타데이터 생성
          const title = customTitleRef.current;
          const part = recordingPartRef.current;
          const memoTitle = title
            ? (part > 1 ? `${title} (${part})` : title)
            : null;

          const memoRes = await fetch("/api/voice-memos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folder,
              filename: uploadData.data.filename,
              duration: currentDuration,
              title: memoTitle,
            }),
          });
          const memoData = await memoRes.json();

          if (!memoData.success) {
            throw new Error(memoData.error || "메모 생성 실패");
          }

          if (wasAutoStopped) {
            toast.info("녹음이 59분 50초에 자동 정지되었습니다", {
              duration: 5000,
            });
          } else {
            toast.success("음성 메모가 저장되었습니다", {
              action: {
                label: "처리하러 가기",
                onClick: () => {
                  window.location.href = "/voice-memos";
                },
              },
            });
          }
        } catch (error) {
          console.error("[Recording] 저장 실패:", error);
          toast.error(
            error instanceof Error
              ? error.message
              : "음성 메모 저장에 실패했습니다"
          );
        }

        if (wasAutoStopped) {
          // 자동 정지: 오버레이에 "이어서 녹음" 표시
          setState({
            isRecording: false,
            isPaused: false,
            duration: 0,
            selectedFolder: folder,
            autoStopped: true,
          });
        } else {
          setState({
            isRecording: false,
            isPaused: false,
            duration: 0,
            selectedFolder: null,
            autoStopped: false,
          });
        }
      };

      // 녹음 시작
      mediaRecorder.start(1000);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        selectedFolder: folder,
        autoStopped: false,
      });

      // 타이머 시작
      durationRef.current = 0;
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        const newDuration = durationRef.current;

        // 자동 정지 체크
        if (newDuration >= AUTO_STOP_SECONDS) {
          autoStoppedRef.current = true;
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          return;
        }

        setState((prev) => ({ ...prev, duration: newDuration }));
      }, 1000);
    } catch (err) {
      console.error("[Recording] 녹음 시작 실패:", err);
      cleanupStream();

      if (err instanceof DOMException && err.name === "NotAllowedError") {
        toast.error(
          "마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요."
        );
      } else {
        toast.error("마이크를 사용할 수 없습니다.");
      }
    }
  }, [clearTimer, cleanupStream, generateFilename]);

  // 폴더 선택 후 실제 녹음 시작
  const handleFolderSelect = useCallback(async (folder: string, title?: string) => {
    setShowFolderDialog(false);
    customTitleRef.current = title || null;
    recordingPartRef.current = 1;
    lastFolderRef.current = folder;
    await startRecordingInternal(folder);
  }, [startRecordingInternal]);

  // 녹음 중지 (저장)
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // 일시정지
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      clearTimer();
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, [clearTimer]);

  // 재개
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setState((prev) => ({ ...prev, isPaused: false }));

      // 타이머 재시작
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        const newDuration = durationRef.current;

        // 자동 정지 체크
        if (newDuration >= AUTO_STOP_SECONDS) {
          autoStoppedRef.current = true;
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          return;
        }

        setState((prev) => ({ ...prev, duration: newDuration }));
      }, 1000);
    }
  }, []);

  // 녹음 취소 (저장 안 함)
  const cancelRecording = useCallback(() => {
    clearTimer();
    chunksRef.current = []; // 데이터 비우기 → onstop에서 저장 건너뜀
    if (
      mediaRecorderRef.current?.state === "recording" ||
      mediaRecorderRef.current?.state === "paused"
    ) {
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    customTitleRef.current = null;
    recordingPartRef.current = 1;
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      selectedFolder: null,
      autoStopped: false,
    });
  }, [clearTimer, cleanupStream]);

  // 이어서 녹음 (자동 정지 후)
  const continueRecording = useCallback(async () => {
    const folder = lastFolderRef.current;
    if (!folder) return;
    recordingPartRef.current += 1;
    setState((prev) => ({ ...prev, autoStopped: false }));
    try {
      await startRecordingInternal(folder);
    } catch {
      // 녹음 시작 실패 시 autoStopped 상태 복원
      setState((prev) => ({ ...prev, autoStopped: true }));
      recordingPartRef.current -= 1;
    }
  }, [startRecordingInternal]);

  // 자동 정지 알림 닫기
  const dismissAutoStop = useCallback(() => {
    customTitleRef.current = null;
    recordingPartRef.current = 1;
    lastFolderRef.current = null;
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      selectedFolder: null,
      autoStopped: false,
    });
  }, []);

  const handleFolderCancel = useCallback(() => {
    setShowFolderDialog(false);
  }, []);

  return (
    <RecordingContext.Provider
      value={{
        state,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        cancelRecording,
        continueRecording,
        dismissAutoStop,
      }}
    >
      {children}

      {/* 폴더 선택 다이얼로그 */}
      <FolderSelectDialog
        open={showFolderDialog}
        onSelect={handleFolderSelect}
        onCancel={handleFolderCancel}
      />

      {/* 자동 정지 후 이어서 녹음 오버레이 */}
      {state.autoStopped && !state.isRecording && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl shadow-lg animate-in slide-in-from-bottom-4 duration-300">
          <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-yellow-500" />
          <span className="text-sm">녹음이 59분 50초에 자동 정지되었습니다</span>
          <button
            onClick={continueRecording}
            className="text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            이어서 녹음
          </button>
          <button
            onClick={dismissAutoStop}
            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* 녹음 중 플로팅 오버레이 */}
      {state.isRecording && (
        <RecordingOverlay
          duration={state.duration}
          isPaused={state.isPaused}
          analyser={analyserRef.current}
          warningActive={state.duration >= WARNING_SECONDS}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onCancel={cancelRecording}
        />
      )}
    </RecordingContext.Provider>
  );
}
