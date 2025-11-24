"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/ui/tag-input";
import { X } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    fetchDocuments();
    fetchTags();
  }, []);

  // Read tags from URL params
  useEffect(() => {
    const tagsParam = searchParams.get("tags");
    const excludeParam = searchParams.get("exclude");

    if (tagsParam) {
      const tags = tagsParam.split(",").filter(Boolean).map(decodeURIComponent);
      setSelectedTags(tags);
    } else {
      setSelectedTags([]);
    }

    if (excludeParam) {
      const excluded = excludeParam.split(",").filter(Boolean).map(decodeURIComponent);
      setExcludedTags(excluded);
    } else {
      setExcludedTags([]);
    }
  }, [searchParams]);

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

  async function fetchTags() {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (data.success) {
        setAvailableTags(data.data.tags);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  }

  function handleTagClick(tag: string, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent card click
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    updateFiltersInURL(newTags, excludedTags);
  }

  function handleTagsChange(tags: string[]) {
    updateFiltersInURL(tags, excludedTags);
  }

  function handleExcludedTagsChange(tags: string[]) {
    updateFiltersInURL(selectedTags, tags);
  }

  function updateFiltersInURL(includeTags: string[], excludeTags: string[]) {
    const params = new URLSearchParams();

    if (includeTags.length > 0) {
      params.set("tags", includeTags.map(encodeURIComponent).join(","));
    }

    if (excludeTags.length > 0) {
      params.set("exclude", excludeTags.map(encodeURIComponent).join(","));
    }

    const queryString = params.toString();
    router.push(queryString ? `/documents?${queryString}` : "/documents");
  }

  function removeTag(tagToRemove: string) {
    const newTags = selectedTags.filter((tag) => tag !== tagToRemove);
    updateFiltersInURL(newTags, excludedTags);
  }

  const filteredDocuments = documents.filter((doc) => {
    // Text search filter
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.slug.toLowerCase().includes(searchQuery.toLowerCase());

    // Include tags filter (AND logic - document must have ALL selected tags)
    const matchesIncludeTags =
      selectedTags.length === 0
        ? true
        : selectedTags.every((tag) => doc.frontmatter.tags?.includes(tag));

    // Exclude tags filter (document must NOT have ANY excluded tags)
    const matchesExcludeTags =
      excludedTags.length === 0
        ? true
        : !excludedTags.some((tag) => doc.frontmatter.tags?.includes(tag));

    return matchesSearch && matchesIncludeTags && matchesExcludeTags;
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
          <h1 className="text-4xl font-bold mb-2">Synapse</h1>
          <p className="text-gray-600">Your local-first markdown notes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/tags")}>
            태그 관리
          </Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            그래프 뷰
          </Button>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="mb-6 flex gap-4">
        <Input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => router.push("/editor/new")}>
          + New Note
        </Button>
      </div>

      {/* Tag Filter Inputs */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Include Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            포함 태그 (AND)
          </label>
          <TagInput
            tags={selectedTags}
            onChange={handleTagsChange}
            suggestions={availableTags}
            placeholder="포함할 태그를 선택하세요..."
          />
        </div>

        {/* Exclude Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            제외 태그 (NOT)
          </label>
          <TagInput
            tags={excludedTags}
            onChange={handleExcludedTagsChange}
            suggestions={availableTags}
            placeholder="제외할 태그를 선택하세요..."
            variant="exclude"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 text-sm text-gray-600">
        {filteredDocuments.length} {filteredDocuments.length === 1 ? "note" : "notes"}
        {searchQuery && ` matching "${searchQuery}"`}
        {selectedTags.length > 0 && ` with tags: ${selectedTags.join(", ")}`}
        {excludedTags.length > 0 && ` excluding: ${excludedTags.join(", ")}`}
      </div>

      {/* Documents List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.map((doc) => (
          <Card
            key={doc.slug}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/note/${doc.slug}`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{doc.title}</CardTitle>
              <CardDescription>
                <div className="flex flex-col gap-1 text-xs">
                  <span>Updated: {new Date(doc.updatedAt).toLocaleDateString()}</span>
                  {doc.links.length > 0 && (
                    <span>{doc.links.length} links</span>
                  )}
                  {doc.backlinks.length > 0 && (
                    <span>{doc.backlinks.length} backlinks</span>
                  )}
                  {doc.frontmatter.tags && doc.frontmatter.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {doc.frontmatter.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "secondary"}
                          className="cursor-pointer hover:opacity-80 text-xs"
                          onClick={(e) => handleTagClick(tag, e)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Empty State - No documents at all */}
      {documents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No notes yet. Create your first note!</p>
          <Button onClick={() => router.push("/editor/new")}>+ New Note</Button>
        </div>
      )}

      {/* No Filter Results */}
      {documents.length > 0 && filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-700 font-medium mb-2">현재 조건에 해당하는 문서가 없습니다</p>
          <p className="text-sm text-gray-500">필터를 변경하거나 새 문서를 작성해보세요</p>
        </div>
      )}
    </div>
  );
}
