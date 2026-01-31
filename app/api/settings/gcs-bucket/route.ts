import { NextRequest, NextResponse } from "next/server";
import {
  loadGcsBucketName,
  saveGcsBucketName,
  deleteGcsBucketName,
  loadGcpServiceAccount,
} from "@/lib/gcp-service-account";

/**
 * GET /api/settings/gcs-bucket
 * GCS 버킷명 조회
 */
export async function GET() {
  try {
    const bucketName = await loadGcsBucketName();
    return NextResponse.json({
      success: true,
      data: { bucketName },
    });
  } catch (error) {
    console.error("[GCS Bucket] 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "GCS 버킷 설정 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/gcs-bucket
 * GCS 버킷 설정 저장 (skipValidation=false일 때 버킷 존재 확인/생성)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bucketName, skipValidation } = body;

    if (!bucketName || typeof bucketName !== "string") {
      return NextResponse.json(
        { success: false, error: "버킷명을 입력해주세요" },
        { status: 400 }
      );
    }

    const trimmedName = bucketName.trim();

    // skipValidation: 이름만 저장 (GCS Console에서 수동 생성한 경우)
    if (skipValidation) {
      await saveGcsBucketName(trimmedName);
      return NextResponse.json({
        success: true,
        data: { bucketName: trimmedName, created: false, skippedValidation: true },
      });
    }

    // GCP 서비스 어카운트 확인
    const sa = await loadGcpServiceAccount();
    if (!sa) {
      return NextResponse.json(
        { success: false, error: "GCP 서비스 어카운트가 설정되지 않았습니다" },
        { status: 400 }
      );
    }

    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage({
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
      projectId: sa.project_id,
    });

    const bucket = storage.bucket(trimmedName);

    // 버킷 존재 여부 확인
    const [exists] = await bucket.exists();

    if (!exists) {
      // 버킷 자동 생성
      console.log(`[GCS Bucket] 버킷 생성 중: ${trimmedName}`);
      await storage.createBucket(trimmedName, {
        location: "asia-northeast3", // 서울 리전
        storageClass: "STANDARD",
      });
      console.log(`[GCS Bucket] 버킷 생성 완료: ${trimmedName}`);
    } else {
      console.log(`[GCS Bucket] 기존 버킷 사용: ${trimmedName}`);
    }

    // 설정 저장
    await saveGcsBucketName(trimmedName);

    return NextResponse.json({
      success: true,
      data: { bucketName: trimmedName, created: !exists },
    });
  } catch (error) {
    console.error("[GCS Bucket] 설정 실패:", error);
    const message =
      error instanceof Error ? error.message : "GCS 버킷 설정에 실패했습니다";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/gcs-bucket
 * GCS 버킷명 삭제
 */
export async function DELETE() {
  try {
    await deleteGcsBucketName();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[GCS Bucket] 삭제 실패:", error);
    return NextResponse.json(
      { success: false, error: "GCS 버킷 설정 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
}
