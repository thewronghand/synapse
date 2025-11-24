"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">태그 관리</h1>
          <p className="text-gray-600">
            총 {sortedTags.length}개의 태그 · {documents.length}개의 문서
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/documents")}>
            문서 목록
          </Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            그래프 뷰
          </Button>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={sortBy === "count" ? "default" : "outline"}
          onClick={() => setSortBy("count")}
          size="sm"
        >
          사용 빈도순
        </Button>
        <Button
          variant={sortBy === "name" ? "default" : "outline"}
          onClick={() => setSortBy("name")}
          size="sm"
        >
          이름순
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {sortedTags.map(({ tag, count }) => (
          <Badge
            key={tag}
            className="cursor-pointer bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 px-3 py-2 text-sm transition-colors"
            onClick={() => router.push(`/documents?tags=${encodeURIComponent(tag)}`)}
          >
            <span className="font-medium">{tag}</span>
            <span className="ml-2 text-blue-600">{count}</span>
          </Badge>
        ))}
      </div>

      {/* Empty State */}
      {sortedTags.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">아직 태그가 없습니다.</p>
          <p className="text-sm text-gray-500">문서에 태그를 추가해보세요!</p>
        </div>
      )}
    </div>
  );
}
