import { NextRequest, NextResponse } from "next/server";
import {
  saveGcpServiceAccount,
  deleteGcpServiceAccount,
  getGcpServiceAccountStatus,
  validateServiceAccount,
} from "@/lib/gcp-service-account";

// GCP 서비스 어카운트 연결 상태 확인
export async function GET() {
  try {
    const status = await getGcpServiceAccountStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("GCP SA 상태 확인 실패:", error);
    return NextResponse.json(
      { success: false, error: "상태 확인에 실패했습니다" },
      { status: 500 }
    );
  }
}

// GCP 서비스 어카운트 JSON 업로드
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 JSON 형식입니다" },
        { status: 400 }
      );
    }

    if (!validateServiceAccount(body)) {
      return NextResponse.json(
        {
          success: false,
          error:
            '유효한 서비스 어카운트 파일이 아닙니다. type이 "service_account"이고, project_id, client_email, private_key 필드가 필요합니다.',
        },
        { status: 400 }
      );
    }

    await saveGcpServiceAccount(body);

    return NextResponse.json({
      success: true,
      data: {
        projectId: body.project_id,
        clientEmail: body.client_email,
      },
    });
  } catch (error) {
    console.error("GCP SA 저장 실패:", error);
    return NextResponse.json(
      { success: false, error: "서비스 어카운트 저장에 실패했습니다" },
      { status: 500 }
    );
  }
}

// GCP 서비스 어카운트 연결 해제
export async function DELETE() {
  try {
    await deleteGcpServiceAccount();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("GCP SA 삭제 실패:", error);
    return NextResponse.json(
      { success: false, error: "서비스 어카운트 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
}
