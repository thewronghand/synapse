"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Mic, Upload, Loader2, Save, RotateCcw, Play, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner, LoadingScreen } from "@/components/ui/spinner";
import AppHeader from "@/components/layout/AppHeader";
import { AudioRecorder } from "@/components/meeting/AudioRecorder";
import { AudioUploader } from "@/components/meeting/AudioUploader";
import MarkdownViewer from "@/components/editor/MarkdownViewer";

type MeetingStep = "input" | "transcribing" | "transcript" | "summarizing" | "preview";
type InputMode = "upload" | "record";

function MeetingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folder = searchParams.get("folder") || "default";

  const [step, setStep] = useState<MeetingStep>("input");
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 오디오 파일 업로드 (서버 temp 저장)
  const uploadAudio = useCallback(
    async (file: File): Promise<string | null> => {
      const formData = new FormData();
      formData.append("audio", file);

      try {
        const response = await fetch(
          `/api/upload/audio?folder=${encodeURIComponent(folder)}`,
          { method: "POST", body: formData }
        );
        const result = await response.json();
        if (result.success) {
          return result.data.path;
        }
        toast.error(result.error || "오디오 업로드 실패");
        return null;
      } catch {
        toast.error("오디오 업로드 중 오류가 발생했습니다");
        return null;
      }
    },
    [folder]
  );

  // 전사 실행
  const handleTranscribe = useCallback(async () => {
    if (!audioFile) return;

    setStep("transcribing");

    // 1. 서버에 오디오 업로드 (temp)
    const path = await uploadAudio(audioFile);
    if (path) {
      setAudioPath(path);
    }

    // 2. 전사 요청
    const formData = new FormData();
    formData.append("audio", audioFile);

    try {
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        setTranscript(result.data.transcript);
        setStep("transcript");
      } else {
        toast.error(result.error || "전사 실패");
        setStep("input");
      }
    } catch {
      toast.error("전사 중 오류가 발생했습니다");
      setStep("input");
    }
  }, [audioFile, uploadAudio]);

  // 요약 생성
  const handleSummarize = useCallback(async () => {
    if (!transcript.trim()) return;

    setStep("summarizing");

    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const result = await response.json();

      if (result.success) {
        setSummary(result.data.summary);
        // 제목 자동 생성 (요약에서 첫 번째 줄 추출)
        const firstLine = result.data.summary.split("\n").find(
          (line: string) => line.trim() && !line.startsWith("#")
        );
        const today = new Date().toLocaleDateString("ko-KR", {
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
        });
        setTitle(`회의록 ${today}`);
        setStep("preview");
      } else {
        toast.error(result.error || "요약 생성 실패");
        setStep("transcript");
      }
    } catch {
      toast.error("요약 생성 중 오류가 발생했습니다");
      setStep("transcript");
    }
  }, [transcript]);

  // 최종 노트 마크다운 조합
  const buildFinalContent = useCallback(() => {
    const audioTag = audioPath
      ? `\n\n---\n\n!audio[회의 녹음](${audioPath})`
      : "";

    const transcriptSection = transcript
      ? `\n\n:::transcript 전체 녹취록\n${transcript}\n:::`
      : "";

    return `---\ntitle: "${title.replace(/"/g, '\\"')}"\ntags: ["회의록"]\n---\n\n${summary}${audioTag}${transcriptSection}`;
  }, [title, summary, audioPath, transcript]);

  // 노트 저장
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }

    setIsSaving(true);

    try {
      const content = buildFinalContent();

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          folder,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("회의록이 저장되었습니다");
        router.push(
          `/note/${encodeURIComponent(title.trim())}?folder=${encodeURIComponent(folder)}`
        );
      } else {
        toast.error(result.error || "저장 실패");
      }
    } catch {
      toast.error("저장 중 오류가 발생했습니다");
    } finally {
      setIsSaving(false);
    }
  }, [title, buildFinalContent, folder, router]);

  // 처음으로 돌아가기
  const handleReset = useCallback(() => {
    setStep("input");
    setAudioFile(null);
    setAudioPath(null);
    setTranscript("");
    setSummary("");
    setTitle("");
  }, []);

  // 오디오 미리듣기
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // audioFile이 변경되면 미리듣기 URL 생성/해제
  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioPreviewUrl(null);
    }
  }, [audioFile]);

  const togglePreviewPlay = useCallback(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const clearAudioFile = useCallback(() => {
    setAudioFile(null);
    setIsPlaying(false);
  }, []);

  // 파일 선택/녹음 완료 핸들러
  const handleAudioReady = useCallback((file: File) => {
    setAudioFile(file);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="shrink-0 sticky top-0 z-10">
        <AppHeader
          showLogo
          subtitle="새 회의록"
          actions={
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="cursor-pointer"
              title="뒤로"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          }
          showSettings={false}
        />
      </div>

      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 스텝 표시기 */}
          <div className="flex items-center gap-2 text-sm">
            {(
              [
                ["input", "오디오 입력"],
                ["transcribing", "전사 중"],
                ["transcript", "전사 확인"],
                ["summarizing", "요약 중"],
                ["preview", "미리보기"],
              ] as const
            ).map(([key, label], index) => {
              const steps: MeetingStep[] = [
                "input",
                "transcribing",
                "transcript",
                "summarizing",
                "preview",
              ];
              const currentIndex = steps.indexOf(step);
              const stepIndex = index;
              const isActive = step === key;
              const isPast = stepIndex < currentIndex;

              return (
                <div key={key} className="flex items-center gap-2">
                  {index > 0 && (
                    <div
                      className={`w-6 h-px ${isPast || isActive ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step 1: 오디오 입력 */}
          {step === "input" && (
            <section className="border rounded-lg p-6 bg-card space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">오디오 입력</h2>
                <p className="text-sm text-muted-foreground">
                  회의 녹음 파일을 업로드하거나 직접 녹음하세요.
                </p>
              </div>

              {/* 모드 선택 탭 */}
              <div className="flex gap-2 border-b pb-3">
                <button
                  onClick={() => setInputMode("upload")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors cursor-pointer ${
                    inputMode === "upload"
                      ? "bg-primary/10 text-primary border-b-2 border-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  파일 업로드
                </button>
                <button
                  onClick={() => setInputMode("record")}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors cursor-pointer ${
                    inputMode === "record"
                      ? "bg-primary/10 text-primary border-b-2 border-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  직접 녹음
                </button>
              </div>

              {/* 모드별 컴포넌트 */}
              {inputMode === "upload" ? (
                <AudioUploader onFileSelected={handleAudioReady} />
              ) : (
                <AudioRecorder onRecordingComplete={handleAudioReady} />
              )}

              {/* 선택된 오디오 미리듣기 */}
              {audioFile && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 cursor-pointer"
                      onClick={togglePreviewPlay}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{audioFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(audioFile.size / 1024).toFixed(1)} KB · {audioFile.type.split(";")[0]}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={clearAudioFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {audioPreviewUrl && (
                      <audio
                        ref={previewAudioRef}
                        src={audioPreviewUrl}
                        onEnded={() => setIsPlaying(false)}
                      />
                    )}
                  </div>

                  <Button
                    onClick={handleTranscribe}
                    size="lg"
                    className="w-full cursor-pointer"
                  >
                    전사 시작
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Step 2: 전사 중 */}
          {step === "transcribing" && (
            <section className="border rounded-lg p-12 bg-card text-center space-y-4">
              <Spinner size="lg" />
              <p className="text-lg font-medium">음성을 텍스트로 변환하고 있습니다...</p>
              <p className="text-sm text-muted-foreground">
                파일 크기에 따라 시간이 걸릴 수 있습니다.
              </p>
            </section>
          )}

          {/* Step 3: 전사 결과 확인/편집 */}
          {step === "transcript" && (
            <section className="border rounded-lg p-6 bg-card space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">전사 결과</h2>
                <p className="text-sm text-muted-foreground">
                  전사된 텍스트를 확인하고 필요하면 수정하세요.
                </p>
              </div>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full min-h-[200px] p-4 border rounded-lg bg-background text-foreground resize-y text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="전사 결과가 여기에 표시됩니다..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSummarize}
                  size="lg"
                  className="cursor-pointer"
                  disabled={!transcript.trim()}
                >
                  요약 생성
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  처음부터
                </Button>
              </div>
            </section>
          )}

          {/* Step 4: 요약 생성 중 */}
          {step === "summarizing" && (
            <section className="border rounded-lg p-12 bg-card text-center space-y-4">
              <Spinner size="lg" />
              <p className="text-lg font-medium">회의록을 정리하고 있습니다...</p>
              <p className="text-sm text-muted-foreground">
                AI가 회의 내용을 요약하고 있습니다.
              </p>
            </section>
          )}

          {/* Step 5: 미리보기 + 저장 */}
          {step === "preview" && (
            <section className="space-y-6">
              {/* 제목 입력 */}
              <div className="border rounded-lg p-6 bg-card space-y-4">
                <div>
                  <h2 className="text-xl font-semibold mb-2">회의록 저장</h2>
                  <p className="text-sm text-muted-foreground">
                    제목을 확인하고 저장하세요. 저장 후 노트에서 확인할 수 있습니다.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">제목</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="회의록 제목을 입력하세요"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    size="lg"
                    className="cursor-pointer"
                    disabled={isSaving || !title.trim()}
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="sm" />
                        저장 중...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        노트로 저장
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={() => setStep("transcript")}
                    variant="outline"
                    className="cursor-pointer"
                  >
                    전사 수정
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    처음부터
                  </Button>
                </div>
              </div>

              {/* 미리보기 */}
              <div className="border rounded-lg p-6 bg-card">
                <h3 className="text-lg font-semibold mb-4">미리보기</h3>
                <div className="border rounded-lg p-4 bg-background">
                  <MarkdownViewer content={buildFinalContent()} isPreview />
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default function MeetingNewPage() {
  return (
    <Suspense fallback={<LoadingScreen message="로딩 중..." />}>
      <MeetingContent />
    </Suspense>
  );
}
