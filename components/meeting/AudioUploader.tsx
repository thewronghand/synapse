"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileAudio, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
}

const ACCEPT_TYPES = ".mp3,.m4a,.wav,.webm,.ogg,.aac";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioUploader({ onFileSelected }: AudioUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("audio/")) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  if (selectedFile) {
    return (
      <div className="border rounded-lg p-4 flex items-center gap-3">
        <FileAudio className="h-8 w-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(selectedFile.size)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearFile}
          className="shrink-0 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">
        오디오 파일을 끌어다 놓거나 선택하세요
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        MP3, M4A, WAV, WebM, OGG (최대 100MB)
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_TYPES}
        onChange={handleChange}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer"
      >
        파일 선택
      </Button>
    </div>
  );
}
