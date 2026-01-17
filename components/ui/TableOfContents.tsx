"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TocItem } from "@/lib/toc";

interface TableOfContentsProps {
  headings: TocItem[];
  className?: string;
}

export function TableOfContents({ headings, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

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

  function handleClick(id: string) {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100; // Account for sticky header
      const targetPosition = element.getBoundingClientRect().top + window.scrollY - headerOffset;
      const startPosition = window.scrollY;
      const distance = targetPosition - startPosition;
      const duration = 200; // Fast animation (200ms)
      let startTime: number | null = null;

      function animation(currentTime: number) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        // Ease-out curve for smooth deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startPosition + distance * easeOut);
        if (timeElapsed < duration) {
          requestAnimationFrame(animation);
        }
      }

      requestAnimationFrame(animation);
    }
  }

  if (headings.length < 2) {
    return null;
  }

  return (
    <nav className={cn("space-y-1 hidden lg:block", className)}>
      <h3 className="text-sm font-semibold mb-3">목차</h3>
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
  );
}
