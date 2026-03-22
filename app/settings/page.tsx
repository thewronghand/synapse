"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/ui/spinner";
import AppHeader from "@/components/layout/AppHeader";
import { ArrowLeft, Cloud, FolderSync, Ghost, Trash2, Palette } from "lucide-react";
import { TrashManager } from "@/components/settings/TrashManager";
import { UISettings } from "@/components/settings/UISettings";
import { PublishSettings } from "@/components/settings/PublishSettings";
import { MigrationSettings } from "@/components/settings/MigrationSettings";
import { NeuroSettings } from "@/components/settings/NeuroSettings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function SettingsContent() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-10">
        <AppHeader
          showLogo
          subtitle="앱 설정 및 publish 관리"
          actions={
            <Button variant="outline" size="icon" onClick={() => router.push("/")} className="cursor-pointer" title="뒤로">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          }
          showSettings={false}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="max-w-3xl mx-auto">
        <Tabs defaultValue="publish" className="w-full">
          <TabsList className="w-full justify-start mb-6 h-auto flex-wrap gap-1">
            <TabsTrigger value="publish" className="gap-1.5">
              <Cloud className="h-4 w-4" />
              Publish
            </TabsTrigger>
            <TabsTrigger value="migration" className="gap-1.5">
              <FolderSync className="h-4 w-4" />
              마이그레이션
            </TabsTrigger>
            <TabsTrigger value="neuro" className="gap-1.5">
              <Ghost className="h-4 w-4" />
              Neuro AI
            </TabsTrigger>
            <TabsTrigger value="trash" className="gap-1.5">
              <Trash2 className="h-4 w-4" />
              휴지통
            </TabsTrigger>
            <TabsTrigger value="ui" className="gap-1.5">
              <Palette className="h-4 w-4" />
              UI
            </TabsTrigger>
          </TabsList>

          {/* Publish Tab */}
          <TabsContent value="publish" className="space-y-8">
            <PublishSettings />
          </TabsContent>

          {/* Migration Tab */}
          <TabsContent value="migration" className="space-y-8">
            <MigrationSettings />
          </TabsContent>

          {/* Neuro AI Tab */}
          <TabsContent value="neuro" className="space-y-8">
            <NeuroSettings />
          </TabsContent>

          {/* Trash Tab */}
          <TabsContent value="trash">
            {/* 휴지통 관리 섹션 */}
            <section className="bg-card rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-1">
                <Ghost className="h-5 w-5" />
                <Trash2 className="h-5 w-5" />
                <h2 className="text-xl font-bold">Neuro의 휴지통</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Neuro가 삭제한 문서는 휴지통에 30일간 보관된 후 자동으로 영구 삭제됩니다.
              </p>
              <TrashManager />
            </section>
          </TabsContent>

          {/* UI Tab */}
          <TabsContent value="ui" className="space-y-8">
            <UISettings />
          </TabsContent>
        </Tabs>
      </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="설정 로딩 중..." />}>
      <SettingsContent />
    </Suspense>
  );
}
