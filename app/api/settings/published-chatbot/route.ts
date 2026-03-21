import { NextRequest, NextResponse } from "next/server";
import {
  loadPublishedChatbotSettings,
  savePublishedChatbotSettings,
} from "@/lib/published-chatbot-settings";

// GET: 설정 조회
export async function GET() {
  try {
    const settings = await loadPublishedChatbotSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("[PublishedChatbot Settings] GET error:", error);
    return NextResponse.json(
      { success: false, error: "설정 조회 실패" },
      { status: 500 }
    );
  }
}

// PUT: 설정 저장
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await savePublishedChatbotSettings(body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PublishedChatbot Settings] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "설정 저장 실패" },
      { status: 500 }
    );
  }
}
