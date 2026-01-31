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

// --- Context 타입 ---

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  selectedFolder: string | null;
}

interface RecordingContextType {
  state: RecordingState;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
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
  });

  const [showFolderDialog, setShowFolderDialog] = useState(false);

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

  // 폴더 선택 후 실제 녹음 시작
  const handleFolderSelect = useCallback(async (folder: string) => {
    setShowFolderDialog(false);

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
          });
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const file = new File([blob], `recording-${timestamp}.webm`, {
          type: mimeType,
        });

        const currentDuration = durationRef.current;

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
          const memoRes = await fetch("/api/voice-memos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folder,
              filename: uploadData.data.filename,
              duration: currentDuration,
            }),
          });
          const memoData = await memoRes.json();

          if (!memoData.success) {
            throw new Error(memoData.error || "메모 생성 실패");
          }

          toast.success("음성 메모가 저장되었습니다", {
            action: {
              label: "처리하러 가기",
              onClick: () => {
                // Phase 2에서 /voice-memos 페이지로 연결
                window.location.href = "/voice-memos";
              },
            },
          });
        } catch (error) {
          console.error("[Recording] 저장 실패:", error);
          toast.error(
            error instanceof Error
              ? error.message
              : "음성 메모 저장에 실패했습니다"
          );
        }

        setState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          selectedFolder: null,
        });
      };

      // 녹음 시작
      mediaRecorder.start(1000);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        selectedFolder: folder,
      });

      // 타이머 시작
      durationRef.current = 0;
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
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
  }, [clearTimer, cleanupStream, state.duration]);

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
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
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
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      selectedFolder: null,
    });
  }, [clearTimer, cleanupStream]);

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
      }}
    >
      {children}

      {/* 폴더 선택 다이얼로그 */}
      <FolderSelectDialog
        open={showFolderDialog}
        onSelect={handleFolderSelect}
        onCancel={handleFolderCancel}
      />

      {/* 녹음 중 플로팅 오버레이 */}
      {state.isRecording && (
        <RecordingOverlay
          duration={state.duration}
          isPaused={state.isPaused}
          analyser={analyserRef.current}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onCancel={cancelRecording}
        />
      )}
    </RecordingContext.Provider>
  );
}
