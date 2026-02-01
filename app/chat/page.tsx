"use client";

import { Suspense } from "react";
import { LoadingScreen } from "@/components/ui/spinner";
import { ChatPage } from "@/components/chat/ChatPage";

function ChatContent() {
  return <ChatPage />;
}

export default function ChatPageEntry() {
  return (
    <Suspense fallback={<LoadingScreen message="채팅 로딩 중..." />}>
      <ChatContent />
    </Suspense>
  );
}
