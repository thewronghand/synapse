"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/ui/tag-input";
import { FolderTabs } from "@/components/ui/FolderTabs";
import { Search, Folder, FileText, Type, Plus, ArrowUpDown, Brain } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { isPublishedMode } from "@/lib/env";
import { LoadingScreen } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { useNotesWatcher } from "@/hooks/useNotesWatcher";

interface SearchResult {
  title: string;
  folder: string;
  snippet: string;
  matchStart: number;
  matchEnd: number;
  tags: string[];
}

function DocumentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(""); // User input (immediate)
  const [searchQuery, setSearchQuery] = useState(""); // Debounced search value
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableTitles, setAvailableTitles] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"title" | "content" | "semantic">("title");
  const [semanticMinScore, setSemanticMinScore] = useState<"high" | "medium" | "low">("medium");
  const [contentSearchResults, setContentSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<"title-asc" | "title-desc" | "created-desc" | "created-asc" | "updated-desc" | "updated-asc">("updated-desc");
  const itemsPerPage = 12; // 3x4 grid

  // Track previous filter values to detect actual changes
  const prevFiltersRef = useRef({
    searchQuery: "",
    selectedTags: [] as string[],
    excludedTags: [] as string[],
    selectedFolder: null as string | null,
  });

  const fetchDocuments = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch tags and titles (folder-scoped) when folder changes
  useEffect(() => {
    fetchTags(selectedFolder);
    fetchTitles(selectedFolder);
  }, [selectedFolder]);

  // 파일 와처: 노트 변경 시 자동 새로고침
  useNotesWatcher({
    onNotesChanged: useCallback(() => {
      fetchDocuments();
      fetchTags(selectedFolder);
      fetchTitles(selectedFolder);
    }, [fetchDocuments, selectedFolder]),
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Content/Semantic search when query changes
  useEffect(() => {
    if ((searchMode === "content" || searchMode === "semantic") && searchQuery.trim()) {
      searchContent(searchQuery);
    } else {
      setContentSearchResults([]);
    }
  }, [searchQuery, searchMode, selectedFolder, semanticMinScore]);

  async function searchContent(query: string) {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const folderParam = selectedFolder ? `&folder=${encodeURIComponent(selectedFolder)}` : "";
      const modeParam = searchMode === "semantic" ? "&mode=semantic" : "";
      const scoreMap = { high: 0.85, medium: 0.75, low: 0.7 };
      const minScoreParam = searchMode === "semantic" ? `&minScore=${scoreMap[semanticMinScore]}` : "";
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${folderParam}${modeParam}${minScoreParam}`);
      const data = await res.json();
      if (data.success) {
        setContentSearchResults(data.data.results);
      }
    } catch (err) {
      console.error("Failed to search:", err);
    } finally {
      setIsSearching(false);
    }
  }

  // Reset to page 1 when filters actually change (not just on re-render)
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.searchQuery !== searchQuery ||
      prev.selectedTags.length !== selectedTags.length ||
      prev.selectedTags.some((tag, i) => tag !== selectedTags[i]) ||
      prev.excludedTags.length !== excludedTags.length ||
      prev.excludedTags.some((tag, i) => tag !== excludedTags[i]) ||
      prev.selectedFolder !== selectedFolder;

    if (filtersChanged && currentPage > 1) {
      updateFiltersInURL(selectedTags, excludedTags, 1, selectedFolder);
    }

    // Update ref with current values
    prevFiltersRef.current = {
      searchQuery,
      selectedTags: [...selectedTags],
      excludedTags: [...excludedTags],
      selectedFolder,
    };
  }, [searchQuery, selectedTags, excludedTags, selectedFolder]);

  // Read tags, folder, and page from URL params
  useEffect(() => {
    const tagsParam = searchParams.get("tags");
    const excludeParam = searchParams.get("exclude");
    const pageParam = searchParams.get("page");
    const folderParam = searchParams.get("folder");

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

    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (!isNaN(page) && page > 0) {
        setCurrentPage(page);
      } else {
        setCurrentPage(1);
      }
    } else {
      setCurrentPage(1);
    }

    if (folderParam) {
      setSelectedFolder(decodeURIComponent(folderParam));
    } else {
      setSelectedFolder(null);
    }
  }, [searchParams]);

  async function fetchTags(folder: string | null) {
    try {
      const folderParam = folder ? `?folder=${encodeURIComponent(folder)}` : "";
      const res = await fetch(`/api/tags${folderParam}`);
      const data = await res.json();
      if (data.success) {
        setAvailableTags(data.data.tags);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  }

  async function fetchTitles(folder: string | null) {
    try {
      const folderParam = folder ? `?folder=${encodeURIComponent(folder)}` : "";
      const res = await fetch(`/api/documents/titles${folderParam}`);
      const data = await res.json();
      if (data.success) {
        setAvailableTitles(data.data.titles);
      }
    } catch (err) {
      console.error("Failed to fetch titles:", err);
    }
  }

  function handleTagClick(tag: string, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent card click
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    updateFiltersInURL(newTags, excludedTags, 1, selectedFolder);
  }

  function handleTagsChange(tags: string[]) {
    updateFiltersInURL(tags, excludedTags, 1, selectedFolder);
  }

  function handleExcludedTagsChange(tags: string[]) {
    updateFiltersInURL(selectedTags, tags, 1, selectedFolder);
  }

  function updateFiltersInURL(includeTags: string[], excludeTags: string[], page: number = 1, folder: string | null = null) {
    const params = new URLSearchParams();

    if (includeTags.length > 0) {
      params.set("tags", includeTags.map(encodeURIComponent).join(","));
    }

    if (excludeTags.length > 0) {
      params.set("exclude", excludeTags.map(encodeURIComponent).join(","));
    }

    if (page > 1) {
      params.set("page", page.toString());
    }

    if (folder) {
      params.set("folder", encodeURIComponent(folder));
    }

    const queryString = params.toString();
    router.push(queryString ? `/documents?${queryString}` : "/documents");
  }

  function handleFolderChange(folder: string | null) {
    updateFiltersInURL(selectedTags, excludedTags, 1, folder);
  }

  function handlePageChange(page: number) {
    updateFiltersInURL(selectedTags, excludedTags, page, selectedFolder);
  }

  function removeTag(tagToRemove: string) {
    const newTags = selectedTags.filter((tag) => tag !== tagToRemove);
    updateFiltersInURL(newTags, excludedTags, 1, selectedFolder);
  }

  // Get search suggestions based on input
  const searchSuggestions = searchInput
    ? availableTitles
        .filter(title =>
          title.toLowerCase().includes(searchInput.toLowerCase())
        )
        .slice(0, 5) // Limit to 5 suggestions
    : [];

  const filteredDocuments = documents.filter((doc) => {
    // Folder filter
    const matchesFolder =
      selectedFolder === null ? true : doc.folder === selectedFolder;

    // Text search filter - 제목 기반 검색
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase());

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

    return matchesFolder && matchesSearch && matchesIncludeTags && matchesExcludeTags;
  });

  // 정렬
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case "title-asc":
        return a.title.localeCompare(b.title, "ko");
      case "title-desc":
        return b.title.localeCompare(a.title, "ko");
      case "created-desc":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "created-asc":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "updated-desc":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "updated-asc":
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      default:
        return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = sortedDocuments.slice(startIndex, endIndex);

  if (isLoading) {
    return <LoadingScreen message="문서 로딩 중..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-10">
        <AppHeader
          showLogo
          actions={
            !isPublishedMode() ? (
              <Button onClick={() => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`)} className="cursor-pointer">
                + 새 노트
              </Button>
            ) : undefined
          }
          mobileMenuItems={
            !isPublishedMode() ? [
              {
                label: "새 노트",
                icon: <Plus className="h-4 w-4" />,
                onClick: () => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`),
              },
            ] : []
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

      {/* Search and Actions */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          {/* Search Mode Toggle */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex z-10">
            <button
              onClick={() => setSearchMode("title")}
              className={cn(
                "p-1.5 rounded-l border-r transition-colors",
                searchMode === "title"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="제목 검색"
            >
              <Type className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSearchMode("content")}
              className={cn(
                "p-1.5 border-r transition-colors",
                searchMode === "content"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="내용 검색"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSearchMode("semantic")}
              className={cn(
                "p-1.5 rounded-r transition-colors",
                searchMode === "semantic"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="의미 검색"
            >
              <Brain className="w-4 h-4" />
            </button>
          </div>
          <Input
            type="text"
            placeholder={searchMode === "title" ? "제목으로 검색..." : searchMode === "content" ? "내용으로 검색..." : "의미로 검색... (예: 지난 회의에서 논의한 내용)"}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSelectedSearchIndex(0);
            }}
            onFocus={() => searchMode === "title" && setShowSearchSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (searchMode !== "title" || !showSearchSuggestions || searchSuggestions.length === 0) return;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedSearchIndex((prev) =>
                  prev < searchSuggestions.length - 1 ? prev + 1 : prev
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedSearchIndex((prev) => (prev > 0 ? prev - 1 : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                setSearchInput(searchSuggestions[selectedSearchIndex]);
                setShowSearchSuggestions(false);
              } else if (e.key === "Escape") {
                setShowSearchSuggestions(false);
              }
            }}
            className="pl-28 bg-card border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />

          {/* Search Suggestions Dropdown (title mode only) */}
          {searchMode === "title" && showSearchSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg max-h-[200px] overflow-y-auto z-10">
              {searchSuggestions.map((title, index) => (
                <button
                  key={title}
                  onClick={() => {
                    setSearchInput(title);
                    setShowSearchSuggestions(false);
                  }}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-primary/10 ${
                    index === selectedSearchIndex
                      ? "bg-primary/20 text-primary"
                      : ""
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 시맨틱 유사도 수준 선택 */}
        {searchMode === "semantic" && (
          <select
            value={semanticMinScore}
            onChange={(e) => setSemanticMinScore(e.target.value as "high" | "medium" | "low")}
            className="h-9 rounded-md border bg-card px-2 text-sm text-foreground cursor-pointer"
          >
            <option value="high">높은 유사도</option>
            <option value="medium">보통 유사도</option>
            <option value="low">낮은 유사도</option>
          </select>
        )}
      </div>

      {/* Tag Filter Inputs */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Include Tags */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
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
            <label className="block text-sm font-medium text-muted-foreground mb-2">
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
        <p className="text-xs text-muted-foreground mt-2">
          💡 Enter, 쉼표, 스페이스로 태그 추가
        </p>
      </div>

      {/* Stats + Sort */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
        {(searchMode === "content" || searchMode === "semantic") && searchQuery ? (
          isSearching ? (
            "검색 중..."
          ) : (() => {
            const filteredResults = contentSearchResults.filter((result) => {
              const matchesIncludeTags =
                selectedTags.length === 0 || selectedTags.every((tag) => result.tags?.includes(tag));
              const matchesExcludeTags =
                excludedTags.length === 0 || !excludedTags.some((tag) => result.tags?.includes(tag));
              return matchesIncludeTags && matchesExcludeTags;
            });
            return filteredResults.length > 0
              ? `${filteredResults.length}개의 검색 결과${selectedTags.length > 0 || excludedTags.length > 0 ? ' (필터 적용됨)' : ''}`
              : "검색 결과 없음";
          })()
        ) : sortedDocuments.length > 0 ? (
          <>
            Showing {startIndex + 1}-{Math.min(endIndex, sortedDocuments.length)} of {sortedDocuments.length} {sortedDocuments.length === 1 ? "note" : "notes"}
            {searchQuery && ` matching "${searchQuery}"`}
            {selectedTags.length > 0 && ` with tags: ${selectedTags.join(", ")}`}
            {excludedTags.length > 0 && ` excluding: ${excludedTags.join(", ")}`}
          </>
        ) : (
          "0 notes"
        )}
        </div>

        {/* 정렬 드롭다운 */}
        {searchMode === "title" && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-sm bg-card border border-border rounded-md px-2 py-1 text-foreground"
            >
              <option value="updated-desc">수정일 (최신순)</option>
              <option value="updated-asc">수정일 (오래된순)</option>
              <option value="created-desc">생성일 (최신순)</option>
              <option value="created-asc">생성일 (오래된순)</option>
              <option value="title-asc">이름순 (ㄱ→ㅎ)</option>
              <option value="title-desc">이름순 (ㅎ→ㄱ)</option>
            </select>
          </div>
        )}
      </div>

      {/* Pagination - Top (only for title search mode) */}
      {searchMode === "title" && totalPages > 1 && (
        <div className="mb-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {/* Content Search Results */}
      {(searchMode === "content" || searchMode === "semantic") && searchQuery && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contentSearchResults
            .filter((result) => {
              // Apply tag filters
              const matchesIncludeTags =
                selectedTags.length === 0
                  ? true
                  : selectedTags.every((tag) => result.tags?.includes(tag));
              const matchesExcludeTags =
                excludedTags.length === 0
                  ? true
                  : !excludedTags.some((tag) => result.tags?.includes(tag));
              return matchesIncludeTags && matchesExcludeTags;
            })
            .map((result, index) => (
            <Card
              key={`${result.folder}-${result.title}-${index}`}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => router.push(`/note/${encodeURIComponent(result.title)}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  {result.title}
                  {selectedFolder === null && result.folder && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs font-normal bg-muted/50 text-muted-foreground border-border/50"
                    >
                      <Folder className="w-3 h-3 mr-1" />
                      {result.folder}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  <div className="text-sm leading-relaxed mt-2">
                    <span>{result.snippet.slice(0, result.matchStart)}</span>
                    <span className="bg-primary/20 text-primary font-medium px-0.5 rounded">
                      {result.snippet.slice(result.matchStart, result.matchEnd)}
                    </span>
                    <span>{result.snippet.slice(result.matchEnd)}</span>
                  </div>
                  {result.tags && result.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-3">
                      {result.tags.map((tag) => (
                        <Badge
                          key={tag}
                          className={`cursor-pointer text-xs transition-colors ${
                            selectedTags.includes(tag)
                              ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                              : "bg-muted text-muted-foreground border-border hover:bg-accent"
                          }`}
                          onClick={(e) => handleTagClick(tag, e)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Documents List (title search mode) */}
      {searchMode === "title" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedDocuments.map((doc) => (
            <Card
              key={doc.title}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => router.push(`/note/${encodeURIComponent(doc.title)}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  {doc.title}
                  {/* Show folder badge when viewing All tab */}
                  {selectedFolder === null && doc.folder && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs font-normal bg-muted/50 text-muted-foreground border-border/50"
                    >
                      <Folder className="w-3 h-3 mr-1" />
                      {doc.folder}
                    </Badge>
                  )}
                </CardTitle>
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
                            className={`cursor-pointer text-xs transition-colors ${
                              selectedTags.includes(tag)
                                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
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
      )}

      {/* Pagination - Bottom (only for title search mode) */}
      {searchMode === "title" && totalPages > 1 && (
        <div className="mt-8">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {/* Empty State - No documents at all */}
      {documents.length === 0 && searchMode === "title" && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {isPublishedMode()
              ? "아직 노트가 없습니다."
              : "아직 노트가 없습니다. 첫 노트를 만들어보세요!"}
          </p>
          {!isPublishedMode() && (
            <Button onClick={() => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`)} className="cursor-pointer">+ 새 노트</Button>
          )}
        </div>
      )}

      {/* No Filter Results - Title mode */}
      {searchMode === "title" && documents.length > 0 && filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <p className="font-medium mb-2">현재 조건에 해당하는 문서가 없습니다</p>
          <p className="text-sm text-muted-foreground">필터를 변경하거나 새 문서를 작성해보세요</p>
        </div>
      )}

      {/* No Search Results - Content mode */}
      {(searchMode === "content" || searchMode === "semantic") && searchQuery && !isSearching && contentSearchResults.length === 0 && (
        <div className="text-center py-12">
          <p className="font-medium mb-2">"{searchQuery}"에 대한 검색 결과가 없습니다</p>
          <p className="text-sm text-muted-foreground">다른 키워드로 검색해보세요</p>
        </div>
      )}

      {/* Content/Semantic mode - No search query yet */}
      {(searchMode === "content" || searchMode === "semantic") && !searchQuery && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="font-medium mb-2">
            {searchMode === "semantic" ? "의미 검색" : "내용 검색"}
          </p>
          <p className="text-sm text-muted-foreground">
            {searchMode === "semantic"
              ? "자연어로 검색하면 의미적으로 관련된 문서를 찾습니다"
              : "검색어를 입력하면 문서 내용에서 검색합니다"}
          </p>
        </div>
      )}
      </main>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="문서 로딩 중..." />}>
      <DocumentsContent />
    </Suspense>
  );
}
