"use client";

import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TocItem } from "@/lib/toc";

interface TableOfContentsProps {
  headings: TocItem[];
  className?: string;
}

export function TableOfContents({ headings, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [hasScrollableContent, setHasScrollableContent] = useState(false);

  // Check if page has scrollable content
  useEffect(() => {
    function checkScrollable() {
      const hasScroll = document.documentElement.scrollHeight > window.innerHeight + 50;
      setHasScrollableContent(hasScroll);
    }

    checkScrollable();

    // Re-check on resize
    window.addEventListener("resize", checkScrollable);

    // Re-check when DOM changes (images loading, etc.)
    const observer = new ResizeObserver(checkScrollable);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("resize", checkScrollable);
      observer.disconnect();
    };
  }, [headings]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0px -80% 0px",
        threshold: 0,
      }
    );

    // Observe all heading elements
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  function smoothScrollTo(targetPosition: number) {
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    const duration = 200;
    let startTime: number | null = null;

    function animation(currentTime: number) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startPosition + distance * easeOut);
      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      }
    }

    requestAnimationFrame(animation);
  }

  function handleClick(id: string) {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const targetPosition = element.getBoundingClientRect().top + window.scrollY - headerOffset;
      smoothScrollTo(targetPosition);
    }
  }

  function scrollToTop() {
    smoothScrollTo(0);
  }

  function scrollToBottom() {
    smoothScrollTo(document.documentElement.scrollHeight - window.innerHeight);
  }

  // Hide if less than 2 headings or no scrollable content
  if (headings.length < 2 || !hasScrollableContent) {
    return null;
  }

  return (
    <div className={cn("bg-card border rounded-lg p-4 hidden lg:block", className)}>
      <nav className="space-y-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">목차</h3>
          <div className="flex gap-1">
            <button
              onClick={scrollToTop}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="맨 위로"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="맨 아래로"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        </div>
        <ul className="space-y-1 text-sm">
          {headings.map((heading) => (
            <li
              key={heading.id}
              style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
            >
              <button
                onClick={() => handleClick(heading.id)}
                className={cn(
                  "text-left w-full py-1 px-2 rounded transition-colors cursor-pointer truncate",
                  "hover:bg-muted",
                  activeId === heading.id
                    ? "text-primary font-medium bg-primary/5"
                    : "text-muted-foreground"
                )}
                title={heading.text}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
