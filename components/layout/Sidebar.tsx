"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Share2,
  FileText,
  PenLine,
  Tags,
  AudioLines,
  Ghost,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPublishedMode } from "@/lib/env";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewNoteDialog } from "@/components/layout/NewNoteDialog";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  action?: "new-note";
}

const navItems: NavItem[] = [
  { icon: Share2, label: "그래프 뷰", href: "/" },
  { icon: FileText, label: "문서 목록", href: "/documents" },
  { icon: PenLine, label: "새 노트", action: "new-note" },
  { icon: Tags, label: "태그 관리", href: "/tags" },
  { icon: AudioLines, label: "음성 메모 목록", href: "/voice-memos" },
  { icon: Ghost, label: "Neuro", href: "/chat" },
  { icon: Settings, label: "설정", href: "/settings" },
];

// Published mode에서는 일부 항목 숨김
const publishedNavItems: NavItem[] = [
  { icon: Share2, label: "그래프 뷰", href: "/" },
  { icon: FileText, label: "문서 목록", href: "/documents" },
  { icon: Tags, label: "태그 관리", href: "/tags" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const isPublished = isPublishedMode();
  const { confirmNavigation } = useNavigationGuard();

  const items = isPublished ? publishedNavItems : navItems;

  // Navigation with guard check
  const handleNavigation = (href: string) => {
    confirmNavigation(() => {
      router.push(href);
    });
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <TooltipProvider delayDuration={100}>
        <aside className="fixed left-0 top-0 z-40 h-screen w-11 md:w-14 border-r bg-background flex flex-col items-center py-4 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            if (item.action === "new-note") {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setNewNoteOpen(true)}
                      className={cn(
                        "flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavigation(item.href!)}
                    className={cn(
                      "flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </aside>
      </TooltipProvider>

      <NewNoteDialog open={newNoteOpen} onOpenChange={setNewNoteOpen} />
    </>
  );
}
