"use client";

import { useState } from "react";
import { List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TocItem } from "@/lib/toc";
import * as Popover from "@radix-ui/react-popover";

interface TocFabProps {
  headings: TocItem[];
}

export function TocFab({ headings }: TocFabProps) {
  const [open, setOpen] = useState(false);

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
      setOpen(false);
    }
  }

  // Don't render if less than 2 headings
  if (headings.length < 2) {
    return null;
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "fixed right-4 top-24 z-40",
            "w-10 h-10 rounded-full shadow-lg",
            "bg-primary text-primary-foreground",
            "flex items-center justify-center",
            "hover:bg-primary/90 transition-colors cursor-pointer",
            "lg:hidden" // Hide on large screens (shown in sidebar)
          )}
          aria-label="목차 열기"
        >
          {open ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-64 max-h-[60vh] overflow-y-auto",
            "bg-card border border-border rounded-lg shadow-lg p-4",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
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
                    "text-left w-full py-1.5 px-2 rounded transition-colors cursor-pointer",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                    "truncate"
                  )}
                  title={heading.text}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
          <Popover.Arrow className="fill-card" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
