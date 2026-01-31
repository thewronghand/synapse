import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { FindInPage } from "@/components/ui/FindInPage";
import { NavigationHandler } from "@/components/ui/NavigationHandler";
import { RecordingProvider } from "@/components/voice-memo/RecordingProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synapse",
  description: "로컬 마크다운 파일 기반의 개인 지식 관리 시스템",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Synapse",
    description: "로컬 마크다운 파일 기반의 개인 지식 관리 시스템",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 512,
        height: 512,
        alt: "Synapse Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Synapse",
    description: "로컬 마크다운 파일 기반의 개인 지식 관리 시스템",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <ConfirmProvider>
            <RecordingProvider>
              <FindInPage />
              <NavigationHandler />
              {children}
              <Toaster />
            </RecordingProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
