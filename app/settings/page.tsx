"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  async function handlePublish() {
    setIsPublishing(true);
    // TODO: Implement publish logic in later phases
    alert("Publish 기능은 곧 구현될 예정입니다!");
    setIsPublishing(false);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={() => router.push("/")} className="cursor-pointer">
            ← 뒤로
          </Button>
          <h1 className="text-4xl font-bold">설정</h1>
        </div>
        <p className="text-gray-600">
          Synapse 앱 설정 및 publish 관리
        </p>
      </div>

      {/* Settings Sections */}
      <div className="max-w-3xl space-y-8">
        {/* Publish Section */}
        <section className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Publish</h2>
          <p className="text-gray-600 mb-6">
            로컬 노트를 읽기 전용 웹사이트로 배포하세요. Vercel을 통해 무료로 publish할 수 있습니다.
          </p>

          <div className="space-y-4">
            {/* Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">배포 상태</h3>
                  <p className="text-sm text-gray-600 mt-1">아직 배포되지 않았습니다</p>
                </div>
                <div className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                  미배포
                </div>
              </div>
            </div>

            {/* Publish Button */}
            <div className="pt-4">
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="cursor-pointer w-full sm:w-auto"
                size="lg"
              >
                {isPublishing ? "Publishing..." : "Publish to Vercel"}
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                처음 publish 시 Vercel 계정 연동이 필요합니다
              </p>
            </div>
          </div>
        </section>

        {/* General Settings Section (Placeholder) */}
        <section className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">일반 설정</h2>
          <p className="text-gray-600">
            추가 설정 항목은 곧 추가될 예정입니다.
          </p>
        </section>
      </div>
    </div>
  );
}
