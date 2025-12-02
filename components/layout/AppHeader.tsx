"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Settings } from "lucide-react";
import { ReactNode } from "react";
import { isPublishedMode } from "@/lib/env";

interface AppHeaderProps {
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  actions?: ReactNode;
  showSettings?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  actions,
  showSettings = true,
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="border-b bg-background p-4">
      <div className="container mx-auto flex items-start justify-between">
        {/* Left side: Title and subtitle */}
        <div>
          {title && (
            typeof title === 'string' ? (
              <h1 className="text-4xl font-bold mb-2">{title}</h1>
            ) : (
              title
            )
          )}
          {subtitle && (
            typeof subtitle === 'string' ? (
              <p className="text-foreground/60">{subtitle}</p>
            ) : (
              subtitle
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
