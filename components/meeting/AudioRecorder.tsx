"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 정리
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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

      mediaRecorder.onstop = () => {
        // 타이머 정리
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // 스트림 트랙 정지
        stream.getTracks().forEach((track) => track.stop());

        // File 객체 생성
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const file = new File([blob], `recording-${timestamp}.webm`, {
          type: mimeType,
        });

        onRecordingComplete(file);
        setIsRecording(false);
        setDuration(0);
      };

      // 녹음 시작
      mediaRecorder.start(1000); // 1초마다 데이터 수집
      setIsRecording(true);
      setDuration(0);

      // 타이머 시작
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("녹음 시작 실패:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
      } else {
        setError("마이크를 사용할 수 없습니다.");
      }
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="border rounded-lg p-6 text-center space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isRecording ? (
        <>
          <div className="flex items-center justify-center gap-2">
            <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-lg font-mono font-semibold">
              {formatDuration(duration)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">녹음 중...</p>
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="lg"
            className="cursor-pointer"
          >
            <Square className="h-4 w-4 mr-2" />
            녹음 중지
          </Button>
        </>
      ) : (
        <>
          <Mic className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            버튼을 눌러 회의 내용을 녹음하세요
          </p>
          <Button
            onClick={startRecording}
            size="lg"
            className="cursor-pointer"
          >
            <Mic className="h-4 w-4 mr-2" />
            녹음 시작
          </Button>
        </>
      )}
    </div>
  );
}
