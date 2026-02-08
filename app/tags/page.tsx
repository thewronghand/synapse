"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/layout/AppHeader";
import { FolderTabs } from "@/components/ui/FolderTabs";
import { LoadingScreen } from "@/components/ui/spinner";

interface TagStats {
  tag: string;
  count: number;
}

function TagsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "count">("count");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Read folder from URL params
  useEffect(() => {
    const folderParam = searchParams.get("folder");
    if (folderParam) {
      setSelectedFolder(decodeURIComponent(folderParam));
    } else {
      setSelectedFolder(null);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDocuments();
  }, [selectedFolder]);

  async function fetchDocuments() {
    setIsLoading(true);
    try {
      const url = selectedFolder
        ? `/api/documents?folder=${encodeURIComponent(selectedFolder)}`
        : "/api/documents";
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setDocuments(data.data.documents);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFolderChange(folder: string | null) {
    if (folder) {
      router.push(`/tags?folder=${encodeURIComponent(folder)}`);
    } else {
      router.push("/tags");
    }
  }

  // Calculate tag statistics (only from filtered documents)
  const tagStats: TagStats[] = [];
  const tagMap = new Map<string, number>();

  documents.forEach((doc) => {
    doc.frontmatter.tags?.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  tagMap.forEach((count, tag) => {
    tagStats.push({ tag, count });
  });

  // Sort tags
  const sortedTags = [...tagStats].sort((a, b) => {
    if (sortBy === "name") {
      return a.tag.localeCompare(b.tag);
    } else {
      return b.count - a.count;
    }
  });

  if (isLoading) {
    return <LoadingScreen message="태그 로딩 중..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-10">
        <AppHeader
          showLogo
          subtitle={
            selectedFolder
              ? `${selectedFolder} 폴더 · ${sortedTags.length}개 태그 · ${documents.length}개 문서`
              : `전체 · ${sortedTags.length}개 태그 · ${documents.length}개 문서`
          }
                  />
      </div>

      {/* Folder Tabs */}
      <div className="shrink-0 px-4 pt-2 bg-background">
        <FolderTabs
          selectedFolder={selectedFolder}
          onFolderChange={handleFolderChange}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto py-6 px-4">

      {/* Sort Controls */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={sortBy === "count" ? "default" : "outline"}
          onClick={() => setSortBy("count")}
          size="sm"
          className="cursor-pointer"
        >
          사용 빈도순
        </Button>
        <Button
          variant={sortBy === "name" ? "default" : "outline"}
          onClick={() => setSortBy("name")}
          size="sm"
          className="cursor-pointer"
        >
          이름순
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {sortedTags.map(({ tag, count }) => (
          <Badge
            key={tag}
            className="cursor-pointer bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 px-3 py-2 text-sm transition-colors"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("tags", tag);
              if (selectedFolder) {
                params.set("folder", selectedFolder);
              }
              router.push(`/documents?${params.toString()}`);
            }}
          >
            <span className="font-medium">{tag}</span>
            <span className="ml-2 opacity-70">{count}</span>
          </Badge>
        ))}
      </div>

      {/* Empty State */}
      {sortedTags.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {selectedFolder
              ? `"${selectedFolder}" 폴더에 태그가 없습니다.`
              : "아직 태그가 없습니다."}
          </p>
          <p className="text-sm text-muted-foreground">문서에 태그를 추가해보세요!</p>
        </div>
      )}
      </main>
    </div>
  );
}

export default function TagsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="태그 로딩 중..." />}>
      <TagsContent />
    </Suspense>
  );
}
