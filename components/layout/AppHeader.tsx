"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Settings } from "lucide-react";
import { ReactNode } from "react";
import { isPublishedMode } from "@/lib/env";
import Logo from "@/components/ui/Logo";

interface AppHeaderProps {
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  actions?: ReactNode;
  showSettings?: boolean;
  showLogo?: boolean;
}

const DEFAULT_SUBTITLE = "Connect the dots.";

export default function AppHeader({
  title,
  subtitle,
  actions,
  showSettings = true,
  showLogo = false,
}: AppHeaderProps) {
  const router = useRouter();

  // Determine what to show for title
  const displayTitle = showLogo ? <Logo width={160} height={45} /> : title;

  // Determine what to show for subtitle
  const displaySubtitle = showLogo
    ? (subtitle ?? DEFAULT_SUBTITLE)
    : subtitle;

  return (
    <header className="border-b bg-background p-4">
      <div className="container mx-auto flex items-start justify-between">
        {/* Left side: Title and subtitle */}
        <div>
          {displayTitle && (
            typeof displayTitle === 'string' ? (
              <h1 className="text-4xl font-bold mb-2">{displayTitle}</h1>
            ) : (
              displayTitle
            )
          )}
          {displaySubtitle && (
            typeof displaySubtitle === 'string' ? (
              <p className="text-sm text-muted-foreground mt-1">{displaySubtitle}</p>
            ) : (
              displaySubtitle
            )
          )}
        </div>

        {/* Right side: Actions and Settings */}
        <div className="flex gap-2">
          {actions}
          <ThemeToggle />
          {showSettings && !isPublishedMode() && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/settings")}
              className="cursor-pointer"
              title="설정"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
