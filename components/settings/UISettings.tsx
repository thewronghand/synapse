"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Check, Download, Type } from "lucide-react";
import { cn } from "@/lib/utils";

type FontId = "spoqa" | "ibm-plex" | "wanted-sans" | "custom";

interface FontOption {
  id: FontId;
  label: string;
  description: string;
  builtin: boolean;
  cssFamily: string;
  // CDN URL (다운로드용)
  cdnUrl?: string;
}

const FONT_OPTIONS: FontOption[] = [
  {
    id: "spoqa",
    label: "Spoqa Han Sans Neo",
    description: "깔끔하고 심플한 한영 폰트 (기본값)",
    builtin: true,
    cssFamily: "'Spoqa Han Sans Neo', sans-serif",
  },
  {
    id: "ibm-plex",
    label: "IBM Plex Sans KR",
    description: "기술적이고 프로페셔널한 느낌",
    builtin: false,
    cssFamily: "'IBM Plex Sans KR', sans-serif",
    cdnUrl: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&display=swap",
  },
  {
    id: "wanted-sans",
    label: "Wanted Sans",
    description: "모던하고 세련된 디자인",
    builtin: false,
    cssFamily: "'Wanted Sans', sans-serif",
    cdnUrl: "https://cdn.wanted.co.kr/wanted-sans/WantedSans.css",
  },
];

export function UISettings() {
  const [currentFont, setCurrentFont] = useState<FontId>("spoqa");
  const [loading, setLoading] = useState(true);
  const [loadedFonts, setLoadedFonts] = useState<Set<FontId>>(new Set(["spoqa"]));
  const [downloadingFont, setDownloadingFont] = useState<FontId | null>(null);

  // 설정 로드
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/font");
        const data = await res.json();
        if (data.success) {
          setCurrentFont(data.data.fontId);
        }
      } catch (err) {
        console.error("Failed to load font settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // 폰트 다운로드 (CDN에서 로드)
  async function downloadFont(font: FontOption) {
    if (!font.cdnUrl) return;

    setDownloadingFont(font.id);
    try {
      // CSS를 head에 link로 추가
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = font.cdnUrl;
      document.head.appendChild(link);

      // 폰트 로드 대기
      await new Promise<void>((resolve) => {
        link.onload = () => resolve();
        link.onerror = () => resolve(); // 에러여도 진행
        setTimeout(resolve, 3000); // 3초 타임아웃
      });

      setLoadedFonts((prev) => new Set([...prev, font.id]));
      toast.success(`${font.label} 다운로드 완료`);
    } catch {
      toast.error(`${font.label} 다운로드 실패`);
    } finally {
      setDownloadingFont(null);
    }
  }

  // 폰트 적용
  async function applyFont(fontId: FontId) {
    const font = FONT_OPTIONS.find((f) => f.id === fontId);
    if (!font) return;

    // CSS 적용
    document.documentElement.style.setProperty(
      "--font-sans",
      font.cssFamily
    );
    document.body.style.fontFamily = font.cssFamily;

    // 서버에 저장
    try {
      await fetch("/api/settings/font", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontId }),
      });
      setCurrentFont(fontId);
      toast.success(`${font.label} 적용됨`);
    } catch {
      toast.error("폰트 설정 저장 실패");
    }
  }

  if (loading) {
    return <Spinner className="h-6 w-6" />;
  }

  return (
    <div className="space-y-8">
      {/* 폰트 설정 */}
      <section className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-5 w-5" />
          <h2 className="text-xl font-bold">폰트</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          앱 전체에서 사용할 폰트를 선택합니다.
        </p>

        <div className="space-y-2">
          {FONT_OPTIONS.map((font) => {
            const isSelected = currentFont === font.id;
            const isLoaded = font.builtin || loadedFonts.has(font.id);
            const isDownloading = downloadingFont === font.id;

            return (
              <div
                key={font.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{font.label}</span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                        <Check className="w-3 h-3" />
                        사용 중
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {font.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!font.builtin && !isLoaded && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={isDownloading}
                      onClick={() => downloadFont(font)}
                    >
                      {isDownloading ? (
                        <Spinner className="h-3 w-3 mr-1" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      다운로드
                    </Button>
                  )}
                  {isLoaded && !isSelected && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => applyFont(font.id)}
                    >
                      적용
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 폰트 미리보기 */}
        <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-2">미리보기</p>
          <p className="text-lg">가나다라마바사 ABCDEFG abcdefg 1234567890</p>
          <p className="text-sm text-muted-foreground mt-1">
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      </section>
    </div>
  );
}
