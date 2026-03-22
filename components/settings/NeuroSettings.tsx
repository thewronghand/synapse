"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
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
import { Ghost, Upload, Trash2, FolderSync, Bot, Check } from "lucide-react";

export function NeuroSettings() {
  const confirm = useConfirm();

  // GCP Service Account
  const [gcpConnected, setGcpConnected] = useState(false);
  const [gcpLoading, setGcpLoading] = useState(true);
  const [gcpProjectId, setGcpProjectId] = useState<string | null>(null);
  const [gcpClientEmail, setGcpClientEmail] = useState<string | null>(null);
  const [gcpUploading, setGcpUploading] = useState(false);
  const [showGcpDisconnect, setShowGcpDisconnect] = useState(false);
  const gcpFileInputRef = useRef<HTMLInputElement>(null);

  // 벡터 임베딩
  const [embeddingSyncing, setEmbeddingSyncing] = useState(false);
  const [embeddingSyncResult, setEmbeddingSyncResult] = useState<{
    totalDocuments: number;
    errors?: string[];
  } | null>(null);

  // 퍼블리시 챗봇
  const [publishedChatEnabled, setPublishedChatEnabled] = useState(false);
  const [publishedChatDailyLimit, setPublishedChatDailyLimit] = useState(50);
  const [publishedChatInstructions, setPublishedChatInstructions] = useState("");
  const [publishedChatLoading, setPublishedChatLoading] = useState(true);
  const [publishedChatSaving, setPublishedChatSaving] = useState(false);

  // GCS Bucket
  const [gcsBucketName, setGcsBucketName] = useState("");
  const [gcsBucketSaved, setGcsBucketSaved] = useState<string | null>(null);
  const [gcsBucketSaving, setGcsBucketSaving] = useState(false);

  // AI Model
  const [aiModelId, setAiModelId] = useState<string>("gemini-3.0-flash");
  const [aiModels, setAiModels] = useState<{ id: string; label: string; description: string }[]>([]);
  const [aiModelSaving, setAiModelSaving] = useState(false);

  // Working Memory
  const [workingMemory, setWorkingMemory] = useState<string>("");
  const [workingMemoryTemplate, setWorkingMemoryTemplate] = useState<string>("");
  const [workingMemoryLoading, setWorkingMemoryLoading] = useState(true);
  const [workingMemorySaving, setWorkingMemorySaving] = useState(false);
  const [workingMemoryEditing, setWorkingMemoryEditing] = useState(false);
  const [workingMemoryDraft, setWorkingMemoryDraft] = useState<string>("");

  // Custom Instructions
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [customInstructionsLoading, setCustomInstructionsLoading] = useState(true);
  const [customInstructionsSaving, setCustomInstructionsSaving] = useState(false);
  const [customInstructionsEditing, setCustomInstructionsEditing] = useState(false);
  const [customInstructionsDraft, setCustomInstructionsDraft] = useState<string>("");

  useEffect(() => {
    checkGcpConnection();
    checkGcsBucket();
    checkAiModelSettings();
    checkWorkingMemory();
    checkCustomInstructions();
    loadChatbotSettings();
  }, []);

  async function loadChatbotSettings() {
    try {
      const res = await fetch("/api/settings/published-chatbot");
      const data = await res.json();
      if (data.success) {
        setPublishedChatEnabled(data.data.enabled);
        setPublishedChatDailyLimit(data.data.dailyLimit);
        setPublishedChatInstructions(data.data.customInstructions || "");
      }
    } catch (err) {
      console.error("Failed to load chatbot settings:", err);
    } finally {
      setPublishedChatLoading(false);
    }
  }

  async function checkGcpConnection() {
    try {
      const response = await fetch("/api/settings/gcp");
      const result = await response.json();
      if (result.success && result.data.connected) {
        setGcpConnected(true);
        setGcpProjectId(result.data.projectId);
        setGcpClientEmail(result.data.clientEmail);
      } else {
        setGcpConnected(false);
        setGcpProjectId(null);
        setGcpClientEmail(null);
      }
    } catch (error) {
      console.error("GCP 연결 상태 확인 실패:", error);
      setGcpConnected(false);
    } finally {
      setGcpLoading(false);
    }
  }

  async function checkGcsBucket() {
    try {
      const response = await fetch("/api/settings/gcs-bucket");
      const result = await response.json();
      if (result.success && result.data.bucketName) {
        setGcsBucketName(result.data.bucketName);
        setGcsBucketSaved(result.data.bucketName);
      }
    } catch (error) {
      console.error("GCS 버킷 설정 확인 실패:", error);
    }
  }

  async function checkAiModelSettings() {
    try {
      const response = await fetch("/api/settings/ai-model");
      const result = await response.json();
      if (result.success) {
        setAiModelId(result.data.modelId);
        setAiModels(result.data.models);
      }
    } catch (error) {
      console.error("AI 모델 설정 확인 실패:", error);
    }
  }

  async function checkWorkingMemory() {
    try {
      const response = await fetch("/api/settings/working-memory");
      const result = await response.json();
      if (result.success) {
        setWorkingMemory(result.data.content);
        setWorkingMemoryTemplate(result.data.template);
      }
    } catch (error) {
      console.error("Working Memory 확인 실패:", error);
    } finally {
      setWorkingMemoryLoading(false);
    }
  }

  async function handleSaveWorkingMemory() {
    setWorkingMemorySaving(true);
    try {
      const response = await fetch("/api/settings/working-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: workingMemoryDraft }),
      });
      const result = await response.json();
      if (result.success) {
        setWorkingMemory(result.data.content);
        setWorkingMemoryEditing(false);
        toast.success("Working Memory가 저장되었습니다");
      } else {
        toast.error(result.error || "저장 실패");
      }
    } catch (error) {
      console.error("Working Memory 저장 실패:", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setWorkingMemorySaving(false);
    }
  }

  async function handleResetWorkingMemory() {
    const confirmed = await confirm({
      title: "Working Memory 초기화",
      description: "AI가 기억하고 있는 사용자 정보를 모두 삭제합니다. 계속하시겠습니까?",
      confirmLabel: "초기화",
    });

    if (!confirmed) return;

    try {
      const response = await fetch("/api/settings/working-memory", {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        setWorkingMemory("");
        setWorkingMemoryEditing(false);
        toast.success("Working Memory가 초기화되었습니다");
      } else {
        toast.error(result.error || "초기화 실패");
      }
    } catch (error) {
      console.error("Working Memory 초기화 실패:", error);
      toast.error("초기화에 실패했습니다");
    }
  }

  function startEditingWorkingMemory() {
    setWorkingMemoryDraft(workingMemory || workingMemoryTemplate);
    setWorkingMemoryEditing(true);
  }

  function cancelEditingWorkingMemory() {
    setWorkingMemoryEditing(false);
    setWorkingMemoryDraft("");
  }

  async function checkCustomInstructions() {
    try {
      const response = await fetch("/api/settings/neuro-prompt");
      const result = await response.json();
      if (result.success) {
        setCustomInstructions(result.data.customInstructions || "");
      }
    } catch (error) {
      console.error("커스텀 지시사항 확인 실패:", error);
    } finally {
      setCustomInstructionsLoading(false);
    }
  }

  async function handleSaveCustomInstructions() {
    setCustomInstructionsSaving(true);
    try {
      const response = await fetch("/api/settings/neuro-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customInstructions: customInstructionsDraft }),
      });
      const result = await response.json();
      if (result.success) {
        setCustomInstructions(result.data.customInstructions);
        setCustomInstructionsEditing(false);
        toast.success("AI 지시사항이 저장되었습니다");
      } else {
        toast.error(result.error || "저장 실패");
      }
    } catch (error) {
      console.error("커스텀 지시사항 저장 실패:", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setCustomInstructionsSaving(false);
    }
  }

  async function handleResetCustomInstructions() {
    const confirmed = await confirm({
      title: "AI 지시사항 초기화",
      description: "커스텀 지시사항을 모두 삭제하고 기본 설정으로 되돌립니다. 계속하시겠습니까?",
      confirmLabel: "초기화",
    });

    if (!confirmed) return;

    try {
      const response = await fetch("/api/settings/neuro-prompt", {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        setCustomInstructions("");
        setCustomInstructionsEditing(false);
        toast.success("AI 지시사항이 초기화되었습니다");
      } else {
        toast.error(result.error || "초기화 실패");
      }
    } catch (error) {
      console.error("커스텀 지시사항 초기화 실패:", error);
      toast.error("초기화에 실패했습니다");
    }
  }

  function startEditingCustomInstructions() {
    setCustomInstructionsDraft(customInstructions);
    setCustomInstructionsEditing(true);
  }

  function cancelEditingCustomInstructions() {
    setCustomInstructionsEditing(false);
    setCustomInstructionsDraft("");
  }

  async function handleSaveAiModel(modelId: string) {
    setAiModelSaving(true);
    try {
      const response = await fetch("/api/settings/ai-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      const result = await response.json();
      if (result.success) {
        setAiModelId(result.data.modelId);
        toast.success("AI 모델이 변경되었습니다");
      } else {
        toast.error(result.error || "모델 변경 실패");
      }
    } catch (error) {
      console.error("AI 모델 저장 실패:", error);
      toast.error("모델 변경에 실패했습니다");
    } finally {
      setAiModelSaving(false);
    }
  }

  async function handleSaveGcsBucket(skipValidation = false) {
    if (!gcsBucketName.trim()) return;

    setGcsBucketSaving(true);
    try {
      const response = await fetch("/api/settings/gcs-bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucketName: gcsBucketName.trim(),
          skipValidation,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setGcsBucketSaved(result.data.bucketName);
        toast.success("GCS 버킷이 설정되었습니다");
      } else {
        toast.error(result.error || "저장에 실패했습니다");
      }
    } catch (error) {
      console.error("GCS 버킷 저장 실패:", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setGcsBucketSaving(false);
    }
  }

  async function handleDeleteGcsBucket() {
    try {
      await fetch("/api/settings/gcs-bucket", { method: "DELETE" });
      setGcsBucketName("");
      setGcsBucketSaved(null);
      toast.success("GCS 버킷 설정이 해제되었습니다");
    } catch (error) {
      console.error("GCS 버킷 삭제 실패:", error);
      toast.error("설정 해제에 실패했습니다");
    }
  }

  async function handleGcpFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGcpUploading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const response = await fetch("/api/settings/gcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("GCP 서비스 어카운트가 연동되었습니다");
        checkGcpConnection();
      } else {
        toast.error(result.error || "서비스 어카운트 저장 실패");
      }
    } catch {
      toast.error("유효하지 않은 JSON 파일입니다");
    } finally {
      setGcpUploading(false);
      // 같은 파일을 다시 선택할 수 있도록 input 초기화
      if (gcpFileInputRef.current) {
        gcpFileInputRef.current.value = "";
      }
    }
  }

  async function executeGcpDisconnect() {
    setShowGcpDisconnect(false);
    try {
      const response = await fetch("/api/settings/gcp", { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        toast.success("GCP 연동이 해제되었습니다");
        checkGcpConnection();
      } else {
        toast.error("연동 해제 실패");
      }
    } catch (error) {
      console.error("GCP 연동 해제 실패:", error);
      toast.error("연동 해제 중 오류가 발생했습니다");
    }
  }

  return (
    <>
      {/* AI Settings Section */}
      <section className="border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Ghost className="h-6 w-6" />
          <h2 className="text-2xl font-semibold">AI 설정</h2>
        </div>
        <p className="text-muted-foreground mb-6">
          AI 기능(회의록 전사, 요약 등)을 사용하려면 GCP 서비스 어카운트를 연동하세요.
          Google Cloud Speech-to-Text와 Vertex AI(Gemini)를 사용합니다.
        </p>

        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold">GCP 서비스 어카운트</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {gcpLoading
                    ? "확인 중..."
                    : gcpConnected
                      ? "서비스 어카운트가 연동되었습니다"
                      : "서비스 어카운트 JSON 파일을 업로드하세요"}
                </p>
                {gcpConnected && gcpProjectId && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    <p>프로젝트: <span className="font-mono">{gcpProjectId}</span></p>
                    <p>계정: <span className="font-mono">{gcpClientEmail}</span></p>
                  </div>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                gcpConnected
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              }`}>
                {gcpConnected ? "연동됨" : "미연동"}
              </div>
            </div>
            {!gcpLoading && (
              <div className="mt-4 flex gap-2">
                {!gcpConnected ? (
                  <>
                    <input
                      ref={gcpFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleGcpFileUpload}
                      className="hidden"
                    />
                    <Button
                      onClick={() => gcpFileInputRef.current?.click()}
                      variant="outline"
                      className="cursor-pointer"
                      disabled={gcpUploading}
                    >
                      {gcpUploading ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" />
                          업로드 중...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          JSON 파일 업로드
                        </span>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setShowGcpDisconnect(true)}
                    variant="destructive"
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      연동 해제
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {!gcpConnected && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">서비스 어카운트 설정 방법:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Google Cloud Console에서 프로젝트를 생성하거나 선택합니다</li>
                <li>Cloud Speech-to-Text API와 Vertex AI API를 활성화합니다</li>
                <li>IAM에서 서비스 어카운트를 생성하고 필요한 역할을 부여합니다</li>
                <li>서비스 어카운트의 JSON 키 파일을 다운로드합니다</li>
                <li>위 버튼으로 JSON 파일을 업로드합니다</li>
              </ol>
            </div>
          )}

          {/* GCS 버킷 설정 - GCP 연동 시에만 표시 */}
          {gcpConnected && (
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold">GCS 버킷 (선택사항)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                1분 이상의 긴 음성 메모를 전사하려면 Google Cloud Storage 버킷이 필요합니다.
                오디오는 임시 업로드 후 전사 완료 시 자동 삭제됩니다.
              </p>
              {!gcsBucketSaved && (
                <p className="text-xs text-muted-foreground mt-1">
                  GCP Console에서 버킷을 직접 만든 후 이름만 입력하거나,
                  서비스 어카운트에 <span className="font-mono">Storage Admin</span> 역할을 부여하면 자동 생성도 가능합니다.
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={gcsBucketName}
                  onChange={(e) => setGcsBucketName(e.target.value)}
                  placeholder="my-bucket-name"
                  className="flex-1 h-9 px-3 text-sm rounded-md border border-input bg-background"
                  disabled={gcsBucketSaving}
                />
                {gcsBucketSaved ? (
                  <Button
                    onClick={handleDeleteGcsBucket}
                    variant="outline"
                    className="cursor-pointer shrink-0"
                  >
                    해제
                  </Button>
                ) : null}
                {!gcsBucketSaved && (
                  <Button
                    onClick={() => handleSaveGcsBucket(true)}
                    variant="outline"
                    className="cursor-pointer shrink-0"
                    disabled={gcsBucketSaving || !gcsBucketName.trim()}
                  >
                    {gcsBucketSaving ? "저장 중..." : "이름만 저장"}
                  </Button>
                )}
                <Button
                  onClick={() => handleSaveGcsBucket(false)}
                  variant="outline"
                  className="cursor-pointer shrink-0"
                  disabled={gcsBucketSaving || !gcsBucketName.trim() || gcsBucketName.trim() === gcsBucketSaved}
                >
                  {gcsBucketSaving ? "설정 중..." : gcsBucketSaved ? "저장" : "생성 및 저장"}
                </Button>
              </div>
              {gcsBucketSaved && (
                <p className="text-xs text-success mt-2">
                  버킷 설정됨: <span className="font-mono">{gcsBucketSaved}</span>
                </p>
              )}
            </div>
          )}

          {/* AI 챗봇 모델 선택 - GCP 연동 시에만 표시 */}
          {gcpConnected && aiModels.length > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold">AI 챗봇 모델</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                채팅에 사용할 AI 모델을 선택합니다.
              </p>
              <div className="space-y-2">
                {aiModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSaveAiModel(model.id)}
                    disabled={aiModelSaving}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors cursor-pointer ${
                      aiModelId === model.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-accent"
                    } ${aiModelSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{model.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {model.description}
                        </p>
                      </div>
                      {aiModelId === model.id && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Check className="w-3 h-3" />
                          사용 중
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Working Memory - GCP 연동 시에만 표시 */}
          {gcpConnected && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Working Memory</h3>
                {!workingMemoryLoading && workingMemory && !workingMemoryEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetWorkingMemory}
                    className="text-destructive hover:text-destructive cursor-pointer h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    초기화
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                AI가 대화를 통해 기억하는 사용자 정보입니다. 세션이 바뀌어도 유지됩니다.
              </p>

              {workingMemoryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" />
                  <span>로딩 중...</span>
                </div>
              ) : workingMemoryEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={workingMemoryDraft}
                    onChange={(e) => setWorkingMemoryDraft(e.target.value)}
                    className="w-full h-48 px-3 py-2 text-sm font-mono rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={workingMemoryTemplate}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveWorkingMemory}
                      disabled={workingMemorySaving}
                      size="sm"
                      className="cursor-pointer"
                    >
                      {workingMemorySaving ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" />
                          저장 중...
                        </span>
                      ) : "저장"}
                    </Button>
                    <Button
                      onClick={cancelEditingWorkingMemory}
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={workingMemorySaving}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : workingMemory ? (
                <div className="space-y-3">
                  <pre className="w-full p-3 text-sm font-mono rounded-md border border-border bg-background whitespace-pre-wrap break-words">
                    {workingMemory}
                  </pre>
                  <Button
                    onClick={startEditingWorkingMemory}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    편집
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground italic">
                    아직 저장된 정보가 없습니다. AI와 대화하면 자동으로 정보가 수집됩니다.
                  </p>
                  <Button
                    onClick={startEditingWorkingMemory}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    직접 입력
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* AI 커스텀 지시사항 - GCP 연동 시에만 표시 */}
          {gcpConnected && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">AI 지시사항</h3>
                {!customInstructionsLoading && customInstructions && !customInstructionsEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetCustomInstructions}
                    className="text-destructive hover:text-destructive cursor-pointer h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    초기화
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Neuro에게 추가 지시사항을 설정하세요. 기본 시스템 프롬프트 뒤에 추가됩니다.
              </p>

              {customInstructionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" />
                  <span>로딩 중...</span>
                </div>
              ) : customInstructionsEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={customInstructionsDraft}
                    onChange={(e) => setCustomInstructionsDraft(e.target.value)}
                    className="w-full h-48 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="예: 항상 반말로 대답해줘. / 코드 예시를 많이 포함해줘. / 답변은 3문장 이내로 간결하게."
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveCustomInstructions}
                      disabled={customInstructionsSaving}
                      size="sm"
                      className="cursor-pointer"
                    >
                      {customInstructionsSaving ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" />
                          저장 중...
                        </span>
                      ) : "저장"}
                    </Button>
                    <Button
                      onClick={cancelEditingCustomInstructions}
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={customInstructionsSaving}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : customInstructions ? (
                <div className="space-y-3">
                  <pre className="w-full p-3 text-sm rounded-md border border-border bg-background whitespace-pre-wrap break-words">
                    {customInstructions}
                  </pre>
                  <Button
                    onClick={startEditingCustomInstructions}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    편집
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground italic">
                    아직 설정된 지시사항이 없습니다. 추가하면 Neuro가 더 맞춤화된 응답을 제공합니다.
                  </p>
                  <Button
                    onClick={startEditingCustomInstructions}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    지시사항 추가
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 벡터 임베딩 동기화 */}
      <section className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderSync className="h-5 w-5" />
          <h2 className="text-xl font-bold">벡터 임베딩</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          문서를 벡터로 변환하여 Neuro가 의미 기반으로 관련 문서를 검색할 수 있게 합니다.
          문서 생성/수정/삭제 시 자동으로 반영되지만, 기존 문서를 일괄 임베딩하거나 동기화가 어긋났을 때 수동으로 실행할 수 있습니다.
        </p>
        <div className="flex items-center gap-3">
          <Button
            onClick={async () => {
              setEmbeddingSyncing(true);
              setEmbeddingSyncResult(null);
              try {
                const res = await fetch("/api/settings/embeddings", {
                  method: "POST",
                });
                const data = await res.json();
                if (data.success) {
                  setEmbeddingSyncResult(data.data);
                  toast.success(
                    `${data.data.totalDocuments}개 문서 임베딩 완료`
                  );
                } else {
                  toast.error(data.error || "임베딩 동기화 실패");
                }
              } catch (err) {
                toast.error("임베딩 동기화 중 오류가 발생했습니다.");
                console.error(err);
              } finally {
                setEmbeddingSyncing(false);
              }
            }}
            disabled={embeddingSyncing || !gcpConnected}
            className="cursor-pointer"
          >
            {embeddingSyncing ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                동기화 중...
              </>
            ) : (
              "전체 문서 임베딩"
            )}
          </Button>
          {!gcpConnected && (
            <p className="text-sm text-muted-foreground">
              GCP 서비스 어카운트를 먼저 설정해주세요.
            </p>
          )}
        </div>
        {embeddingSyncResult && (
          <div className="mt-4 p-3 bg-muted rounded-md text-sm">
            <p>
              총 <strong>{embeddingSyncResult.totalDocuments}</strong>개 문서 임베딩 완료
            </p>
            {embeddingSyncResult.errors && embeddingSyncResult.errors.length > 0 && (
              <p className="text-destructive mt-1">
                {embeddingSyncResult.errors.length}개 문서에서 오류 발생
              </p>
            )}
          </div>
        )}
      </section>

      {/* 퍼블리시 챗봇 설정 */}
      <section className="bg-card rounded-lg border p-6 opacity-60">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-5 w-5" />
          <h2 className="text-xl font-bold">퍼블리시 챗봇</h2>
        </div>
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            이 기능은 보안 개선 작업 중으로 일시적으로 비활성화되어 있습니다.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            서버리스 환경에서의 사용량 제한 안정성을 개선한 후 다시 활성화될 예정입니다.
          </p>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          퍼블리시된 사이트에서 방문자가 문서에 대해 질문할 수 있는 챗봇을 설정합니다.
        </p>

        {publishedChatLoading ? (
          <Spinner className="h-6 w-6" />
        ) : (
          <div className="space-y-4 pointer-events-none">
            {/* 활성화 토글 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">챗봇 활성화</p>
                <p className="text-xs text-muted-foreground">
                  다음 퍼블리시부터 적용됩니다
                </p>
              </div>
              <button
                onClick={async () => {
                  const newValue = !publishedChatEnabled;
                  setPublishedChatEnabled(newValue);
                  await fetch("/api/settings/published-chatbot", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled: newValue }),
                  });
                  toast.success(newValue ? "챗봇 활성화됨" : "챗봇 비활성화됨");
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  publishedChatEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    publishedChatEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* 일일 사용량 제한 */}
            <div>
              <label className="font-medium text-sm">1일 사용량 제한</label>
              <p className="text-xs text-muted-foreground mb-2">
                방문자가 하루에 보낼 수 있는 최대 메시지 수 (0 = 무제한)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={publishedChatDailyLimit}
                  onChange={(e) =>
                    setPublishedChatDailyLimit(parseInt(e.target.value) || 0)
                  }
                  className="w-24 rounded-md border bg-background px-3 py-1.5 text-sm"
                />
                <span className="text-sm text-muted-foreground">회/일</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={publishedChatSaving}
                  onClick={async () => {
                    setPublishedChatSaving(true);
                    try {
                      await fetch("/api/settings/published-chatbot", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dailyLimit: publishedChatDailyLimit }),
                      });
                      toast.success("사용량 제한 저장됨");
                    } finally {
                      setPublishedChatSaving(false);
                    }
                  }}
                >
                  저장
                </Button>
              </div>
            </div>

            {/* 커스텀 지시사항 */}
            <div>
              <label className="font-medium text-sm">챗봇 커스텀 지시사항</label>
              <p className="text-xs text-muted-foreground mb-2">
                퍼블리시 챗봇의 응답 스타일이나 역할을 지정합니다
              </p>
              <textarea
                value={publishedChatInstructions}
                onChange={(e) => setPublishedChatInstructions(e.target.value)}
                placeholder="예: 이 사이트는 개발 블로그입니다. 기술적인 질문에 친절하게 답변해주세요."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={publishedChatSaving}
                  onClick={async () => {
                    setPublishedChatSaving(true);
                    try {
                      await fetch("/api/settings/published-chatbot", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          customInstructions: publishedChatInstructions,
                        }),
                      });
                      toast.success("지시사항 저장됨");
                    } finally {
                      setPublishedChatSaving(false);
                    }
                  }}
                >
                  저장
                </Button>
              </div>
            </div>

            {!gcpConnected && (
              <p className="text-sm text-amber-500">
                GCP 서비스 어카운트를 먼저 설정해야 챗봇을 사용할 수 있습니다.
              </p>
            )}
          </div>
        )}
      </section>

      {/* GCP Disconnect Confirm Dialog */}
      <AlertDialog open={showGcpDisconnect} onOpenChange={setShowGcpDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GCP 연동 해제</AlertDialogTitle>
            <AlertDialogDescription>
              GCP 서비스 어카운트 연동을 해제하시겠습니까? AI 기능(회의록 전사, 요약)을 사용하려면 다시 연동해야 합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={executeGcpDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              연동 해제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
