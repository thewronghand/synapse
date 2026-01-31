"use client";

import { useRef, useEffect, useCallback } from "react";
import { Pause, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordingOverlayProps {
  duration: number;
  isPaused: boolean;
  analyser: AnalyserNode | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

// 시각화에 사용할 바 개수
const BAR_COUNT = 20;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 실시간 오디오 웨이브폼 시각화 컴포넌트
 */
function AudioWaveform({
  analyser,
  isPaused,
}: {
  analyser: AnalyserNode | null;
  isPaused: boolean;
}) {
  const barsRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  const animate = useCallback(() => {
    if (!analyser || !barsRef.current) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const bars = barsRef.current.children;
    const binSize = Math.floor(dataArray.length / BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      // 주파수 구간별 평균 구하기
      let sum = 0;
      for (let j = 0; j < binSize; j++) {
        sum += dataArray[i * binSize + j];
      }
      const average = sum / binSize;

      // 0~255 → 10%~100% 높이로 변환
      const height = Math.max(10, (average / 255) * 100);

      const bar = bars[i] as HTMLDivElement | undefined;
      if (bar) {
        bar.style.height = `${height}%`;
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [analyser]);

  useEffect(() => {
    if (!analyser || isPaused) {
      // 일시정지 시 바를 최소 높이로
      if (barsRef.current) {
        const bars = barsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          (bars[i] as HTMLDivElement).style.height = "10%";
        }
      }
      return;
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [analyser, isPaused, animate]);

  return (
    <div
      ref={barsRef}
      className="flex items-end gap-0.5 h-6 w-[60px]"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-full bg-primary/70 transition-[height] duration-75"
          style={{ height: "10%", minHeight: "2px" }}
        />
      ))}
    </div>
  );
}

export function RecordingOverlay({
  duration,
  isPaused,
  analyser,
  onPause,
  onResume,
  onStop,
  onCancel,
}: RecordingOverlayProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      {/* 녹음 상태 표시 */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
            isPaused
              ? "bg-yellow-500"
              : "bg-destructive animate-pulse"
          }`}
        />
      </div>

      {/* 웨이브폼 시각화 */}
      <AudioWaveform analyser={analyser} isPaused={isPaused} />

      {/* 녹음 시간 */}
      <span className="text-lg font-mono font-semibold tabular-nums min-w-[60px] text-center">
        {formatDuration(duration)}
      </span>

      {/* 컨트롤 버튼 */}
      <div className="flex items-center gap-1">
        {/* 일시정지 / 재개 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer"
          onClick={isPaused ? onResume : onPause}
          title={isPaused ? "재개" : "일시정지"}
        >
          {isPaused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </Button>

        {/* 녹음 중지 (저장) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
          onClick={onStop}
          title="녹음 중지"
        >
          <Square className="h-4 w-4" />
        </Button>

        {/* 취소 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer text-muted-foreground"
          onClick={onCancel}
          title="녹음 취소"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
