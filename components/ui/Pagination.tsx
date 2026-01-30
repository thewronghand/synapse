"use client";

import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const [maxVisiblePages, setMaxVisiblePages] = useState(9);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPageRange = useCallback(
    (maxPages: number) => {
      const halfRange = Math.floor(maxPages / 2);

      if (totalPages <= maxPages) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      if (currentPage <= halfRange + 1) {
        return Array.from({ length: maxPages }, (_, i) => i + 1);
      }
      if (currentPage >= totalPages - halfRange) {
        return Array.from(
          { length: maxPages },
          (_, i) => totalPages - maxPages + i + 1,
        );
      }

      return Array.from(
        { length: maxPages },
        (_, i) => currentPage - halfRange + i,
      );
    },
    [currentPage, totalPages],
  );

  useLayoutEffect(() => {
    const checkPageCount = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;

      // 9개 기준으로 표시될 페이지 번호 계산
      const pages = getPageRange(9);
      const threeDigitCount = pages.filter((p) => p >= 100).length;

      // 3자릿수 버튼 수에 따라 임계값 조정
      const threshold = 420 - (9 - threeDigitCount) * 10;
      const newMaxPages = containerWidth < threshold ? 7 : 9;

      setMaxVisiblePages((prev) => (prev !== newMaxPages ? newMaxPages : prev));
    };

    checkPageCount();

    window.addEventListener("resize", checkPageCount);
    return () => window.removeEventListener("resize", checkPageCount);
  }, [totalPages, currentPage, getPageRange]);

  if (totalPages <= 1) return null;

  const pageNumbers = getPageRange(maxVisiblePages);

  return (
    <div ref={containerRef} className="@container">
      <div className="flex items-center justify-center gap-1">
        {/* 맨 처음으로 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="맨 처음"
          className="hidden @[430px]:flex min-w-[32px] font-mono cursor-pointer hover:bg-accent hover:border-border transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          «
        </Button>

        {/* 이전 5페이지 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 5))}
          disabled={currentPage === 1}
          title="이전 5페이지"
          className="hidden @[360px]:flex min-w-[32px] font-mono cursor-pointer hover:bg-accent hover:border-border transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          ‹
        </Button>

        {/* 페이지 번호 */}
        <div className="flex gap-1">
          {pageNumbers.map((page) => (
            <Button
              key={page}
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] font-mono cursor-pointer transition-colors ${
                currentPage === page
                  ? "bg-primary/10 text-primary border-primary/20 font-bold hover:bg-primary/15"
                  : "hover:bg-accent hover:border-border"
              }`}
            >
              {page}
            </Button>
          ))}
        </div>

        {/* 다음 5페이지 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 5))}
          disabled={currentPage === totalPages}
          title="다음 5페이지"
          className="hidden @[360px]:flex min-w-[32px] font-mono cursor-pointer hover:bg-accent hover:border-border transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          ›
        </Button>

        {/* 맨 끝으로 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="맨 끝"
          className="hidden @[430px]:flex min-w-[32px] font-mono cursor-pointer hover:bg-accent hover:border-border transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          »
        </Button>
      </div>
    </div>
  );
}
