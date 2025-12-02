import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
