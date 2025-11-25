"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/ui/tag-input";
import { X, Search } from "lucide-react";

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
  const itemsPerPage = 12; // 3x4 grid

  // Track previous filter values to detect actual changes
  const prevFiltersRef = useRef({
    searchQuery: "",
    selectedTags: [] as string[],
    excludedTags: [] as string[],
  });

  useEffect(() => {
    fetchDocuments();
    fetchTags();
    fetchTitles();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when filters actually change (not just on re-render)
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.searchQuery !== searchQuery ||
      prev.selectedTags.length !== selectedTags.length ||
      prev.selectedTags.some((tag, i) => tag !== selectedTags[i]) ||
      prev.excludedTags.length !== excludedTags.length ||
      prev.excludedTags.some((tag, i) => tag !== excludedTags[i]);

    if (filtersChanged && currentPage > 1) {
      updateFiltersInURL(selectedTags, excludedTags, 1);
    }

    // Update ref with current values
    prevFiltersRef.current = {
      searchQuery,
      selectedTags: [...selectedTags],
      excludedTags: [...excludedTags],
    };
  }, [searchQuery, selectedTags, excludedTags]);

  // Read tags and page from URL params
  useEffect(() => {
    const tagsParam = searchParams.get("tags");
    const excludeParam = searchParams.get("exclude");
    const pageParam = searchParams.get("page");

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

  async function fetchTitles() {
    try {
      const res = await fetch("/api/titles");
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
    updateFiltersInURL(newTags, excludedTags);
  }

  function handleTagsChange(tags: string[]) {
    updateFiltersInURL(tags, excludedTags);
  }

  function handleExcludedTagsChange(tags: string[]) {
    updateFiltersInURL(selectedTags, tags);
  }

  function updateFiltersInURL(includeTags: string[], excludeTags: string[], page: number = 1) {
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

    const queryString = params.toString();
    router.push(queryString ? `/documents?${queryString}` : "/documents");
  }

  function handlePageChange(page: number) {
    updateFiltersInURL(selectedTags, excludedTags, page);
  }

  function removeTag(tagToRemove: string) {
    const newTags = selectedTags.filter((tag) => tag !== tagToRemove);
    updateFiltersInURL(newTags, excludedTags);
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

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Calculate page numbers to display (max 9 pages)
  const maxPageButtons = 9;
  let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

  // Adjust if we're near the end
  if (endPage - startPage + 1 < maxPageButtons) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }

  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  // Pagination component
  const PaginationControls = () => (
    <div className="flex items-center justify-center gap-2">
      {/* First page */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        title="First page"
        className="min-w-[32px] font-mono cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        «
      </Button>

      {/* Previous 5 pages */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(Math.max(1, currentPage - 5))}
        disabled={currentPage === 1}
        title="Previous 5 pages"
        className="min-w-[32px] font-mono cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        ‹
      </Button>

      {/* Page numbers */}
      <div className="flex gap-1">
        {pageNumbers.map((page) => (
          <Button
            key={page}
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page)}
            className={`min-w-[32px] font-mono cursor-pointer transition-colors ${
              currentPage === page
                ? "bg-blue-100 text-blue-800 border-blue-200 font-bold hover:bg-blue-200"
                : "hover:bg-gray-100 hover:border-gray-400"
            }`}
          >
            {page}
          </Button>
        ))}
      </div>

      {/* Next 5 pages */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 5))}
        disabled={currentPage === totalPages}
        title="Next 5 pages"
        className="min-w-[32px] font-mono cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        ›
      </Button>

      {/* Last page */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
        title="Last page"
        className="min-w-[32px] font-mono cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        »
      </Button>
    </div>
  );

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSelectedSearchIndex(0);
            }}
            onFocus={() => setShowSearchSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (!showSearchSuggestions || searchSuggestions.length === 0) return;

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
            className="pl-10"
          />

          {/* Search Suggestions Dropdown */}
          {showSearchSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto z-10">
              {searchSuggestions.map((title, index) => (
                <button
                  key={title}
                  onClick={() => {
                    setSearchInput(title);
                    setShowSearchSuggestions(false);
                  }}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                    index === selectedSearchIndex
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => router.push("/editor/new")}>
          + New Note
        </Button>
      </div>

      {/* Tag Filter Inputs */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <p className="text-xs text-gray-500 mt-2">
          💡 Enter, 쉼표, 스페이스로 태그 추가
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 text-sm text-gray-600">
        {filteredDocuments.length > 0 ? (
          <>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} of {filteredDocuments.length} {filteredDocuments.length === 1 ? "note" : "notes"}
            {searchQuery && ` matching "${searchQuery}"`}
            {selectedTags.length > 0 && ` with tags: ${selectedTags.join(", ")}`}
            {excludedTags.length > 0 && ` excluding: ${excludedTags.join(", ")}`}
          </>
        ) : (
          "0 notes"
        )}
      </div>

      {/* Pagination - Top */}
      {totalPages > 1 && (
        <div className="mb-6">
          <PaginationControls />
        </div>
      )}

      {/* Documents List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedDocuments.map((doc) => (
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
                          className={`cursor-pointer hover:opacity-80 text-xs ${
                            selectedTags.includes(tag)
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
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

      {/* Pagination - Bottom */}
      {totalPages > 1 && (
        <div className="mt-8">
          <PaginationControls />
        </div>
      )}

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

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    }>
      <DocumentsContent />
    </Suspense>
  );
}
