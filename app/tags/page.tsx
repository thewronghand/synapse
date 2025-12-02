"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/layout/AppHeader";

interface TagStats {
  tag: string;
  count: number;
}

export default function TagsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "count">("count");

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents");
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

  // Calculate tag statistics
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <AppHeader
          title="태그 관리"
          subtitle={`총 ${sortedTags.length}개의 태그 · ${documents.length}개의 문서`}
          actions={
            <>
              <Button variant="outline" onClick={() => router.push("/documents")} className="cursor-pointer">
                문서 목록
              </Button>
              <Button variant="outline" onClick={() => router.push("/")} className="cursor-pointer">
                그래프 뷰
              </Button>
            </>
          }
        />
      </div>

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
            onClick={() => router.push(`/documents?tags=${encodeURIComponent(tag)}`)}
          >
            <span className="font-medium">{tag}</span>
            <span className="ml-2 opacity-70">{count}</span>
          </Badge>
        ))}
      </div>

      {/* Empty State */}
      {sortedTags.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">아직 태그가 없습니다.</p>
          <p className="text-sm text-muted-foreground">문서에 태그를 추가해보세요!</p>
        </div>
      )}
    </div>
  );
}
