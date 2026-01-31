"use client";

import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecording } from "@/components/voice-memo/RecordingProvider";

/**
 * 글로벌 녹음 시작 버튼 (AppHeader에 배치)
 * 녹음 중이면 비활성화 아이콘 표시
 */
export function RecordingButton() {
  const { state, startRecording } = useRecording();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={startRecording}
      disabled={state.isRecording}
      className="cursor-pointer"
      title={state.isRecording ? "녹음 중..." : "음성 메모 녹음"}
    >
      {state.isRecording ? (
        <MicOff className="h-4 w-4 text-destructive" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
