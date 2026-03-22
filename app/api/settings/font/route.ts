import { NextRequest, NextResponse } from "next/server";
import { loadFontSettings, saveFontSettings } from "@/lib/font-settings";

export async function GET() {
  try {
    const settings = await loadFontSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("[Font Settings] GET error:", error);
    return NextResponse.json(
      { success: false, error: "폰트 설정 조회 실패" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await saveFontSettings(body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Font Settings] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "폰트 설정 저장 실패" },
      { status: 500 }
    );
  }
}
