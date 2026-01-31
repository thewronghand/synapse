"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Settings, EllipsisVertical, Sun, Moon } from "lucide-react";
import { ReactNode } from "react";
import { isPublishedMode } from "@/lib/env";
import { RecordingButton } from "@/components/voice-memo/RecordingButton";
import { useTheme } from "next-themes";
import Logo from "@/components/ui/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MobileMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface AppHeaderProps {
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  actions?: ReactNode;
  showSettings?: boolean;
  showLogo?: boolean;
  /** 모바일 드롭다운 메뉴 항목 - 전달 시 모바일에서 actions 대신 햄버거 메뉴 표시 */
  mobileMenuItems?: MobileMenuItem[];
}

const DEFAULT_SUBTITLE = "Connect the dots.";

export default function AppHeader({
  title,
  subtitle,
  actions,
  showSettings = true,
  showLogo = false,
  mobileMenuItems,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isHome = pathname === "/";

  // Determine what to show for title
  const displayTitle = showLogo ? (
    isHome ? (
      <Logo width={160} height={45} />
    ) : (
      <Link href="/">
        <Logo width={160} height={45} className="cursor-pointer" />
      </Link>
    )
  ) : title;

  // Determine what to show for subtitle
  const displaySubtitle = showLogo
    ? (subtitle ?? DEFAULT_SUBTITLE)
    : subtitle;

  const hasMobileMenu = mobileMenuItems && mobileMenuItems.length > 0;

  return (
    <header className="border-b bg-background p-4">
      <div className="container mx-auto flex items-center justify-between">
        {/* Left side: Title and subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          {displayTitle && (
            typeof displayTitle === 'string' ? (
              <h1 className="text-4xl font-bold">{displayTitle}</h1>
            ) : (
              displayTitle
            )
          )}
          {displaySubtitle && (
            typeof displaySubtitle === 'string' ? (
              <p className="text-sm text-muted-foreground truncate">{displaySubtitle}</p>
            ) : (
              displaySubtitle
            )
          )}
        </div>

        {/* Right side */}
        {hasMobileMenu ? (
          <>
            {/* 데스크톱: 버튼 직접 노출 */}
            <div className="hidden md:flex gap-2">
              {actions}
              {!isPublishedMode() && <RecordingButton />}
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

            {/* 모바일: 드롭다운 메뉴 */}
            <div className="md:hidden flex gap-2">
              {!isPublishedMode() && <RecordingButton />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="cursor-pointer">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {mobileMenuItems.map((item, index) => (
                    <DropdownMenuItem
                      key={index}
                      className={`cursor-pointer ${item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}`}
                      onClick={item.onClick}
                    >
                      {item.icon}
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {theme === "dark" ? "라이트 모드" : "다크 모드"}
                  </DropdownMenuItem>
                  {showSettings && !isPublishedMode() && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push("/settings")}
                    >
                      <Settings className="h-4 w-4" />
                      설정
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          /* 기존 동작: mobileMenuItems 미전달 시 */
          <div className="flex gap-2">
            {actions}
            {!isPublishedMode() && <RecordingButton />}
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
        )}
      </div>
    </header>
  );
}
