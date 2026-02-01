"use client";

import { Ghost } from "lucide-react";

export function ChatEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
          <Ghost className="w-8 h-8 text-primary animate-neuro-hop" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Neuro와 대화하기</h3>
        <p className="text-sm text-muted-foreground">
          궁금한 것을 질문하면 뉴로가 답변해드려요!
        </p>
      </div>
    </div>
  );
}
