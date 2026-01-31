import { NextRequest, NextResponse } from "next/server";
import {
  loadGcpServiceAccount,
  loadGcsBucketName,
} from "@/lib/gcp-service-account";
import { getSelectedPhrases } from "@/lib/phrase-sets";
import { v2 } from "@google-cloud/speech";

const LOCATION = "us-central1";

/**
 * POST /api/ai/transcribe
 * 오디오 파일을 텍스트로 전사 (Speech-to-Text V2 + Chirp 2)
 * FormData: audio (File)
 */
export async function POST(request: NextRequest) {
  try {
    const sa = await loadGcpServiceAccount();
    if (!sa) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GCP 서비스 어카운트가 설정되지 않았습니다. 설정에서 먼저 연동해주세요.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "오디오 파일이 없습니다" },
        { status: 400 }
      );
    }

    console.log(
      `[Transcribe] 파일: ${audioFile.name}, 타입: ${audioFile.type}, 크기: ${Math.round(audioFile.size / 1024)}KB`
    );

    const credentials = {
      client_email: sa.client_email,
      private_key: sa.private_key,
    };

    // V2 SpeechClient (지역 엔드포인트 사용)
    const speechClient = new v2.SpeechClient({
      credentials,
      projectId: sa.project_id,
      apiEndpoint: `${LOCATION}-speech.googleapis.com`,
    });

    // File → Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const recognizer = `projects/${sa.project_id}/locations/${LOCATION}/recognizers/_`;

    // V2 인식 설정 (Chirp 2 + 인코딩 자동 감지 + 인라인 구문 세트)
    const phrases = await getSelectedPhrases();
    const config: Record<string, unknown> = {
      autoDecodingConfig: {},
      languageCodes: ["ko-KR"],
      model: "chirp_2",
    };

    // 선택된 구문 세트가 있으면 인라인 adaptation 추가
    if (phrases.length > 0) {
      config.adaptation = {
        phraseSets: [
          {
            inlinePhraseSet: {
              phrases: phrases.map((value) => ({ value, boost: 10 })),
            },
          },
        ],
      };
      console.log(
        `[Transcribe] 구문 세트 적용: ${phrases.length}개 구문`
      );
    }

    // GCS 버킷 설정 여부 → 있으면 batchRecognize (긴 오디오), 없으면 recognize (1분 미만)
    const bucketName = await loadGcsBucketName();
    const useBatch = !!bucketName;

    let transcript: string | undefined;

    if (useBatch) {
      // GCS에 임시 업로드 후 batchRecognize
      console.log(
        `[Transcribe] BatchRecognize 사용 (버킷: ${bucketName}, ${Math.round(buffer.length / 1024)}KB)`
      );

      const { Storage } = await import("@google-cloud/storage");
      const storage = new Storage({
        credentials,
        projectId: sa.project_id,
      });

      const tempFileName = `synapse-temp/${Date.now()}-${audioFile.name}`;
      const bucket = storage.bucket(bucketName);
      const gcsFile = bucket.file(tempFileName);

      // GCS에 업로드
      await gcsFile.save(buffer, {
        contentType: audioFile.type,
      });

      const gcsUri = `gs://${bucketName}/${tempFileName}`;
      console.log(`[Transcribe] GCS 업로드 완료: ${gcsUri}`);

      try {
        const [operation] = await speechClient.batchRecognize({
          recognizer,
          config,
          files: [{ uri: gcsUri }],
          recognitionOutputConfig: {
            inlineResponseConfig: {},
          },
        });

        const [response] = await operation.promise();

        // batchRecognize 응답: results 맵에서 transcript 추출
        const inlineResults = response.results;
        if (inlineResults) {
          const transcripts: string[] = [];
          for (const [, fileResult] of Object.entries(inlineResults)) {
            const resultTranscript = fileResult.transcript?.results
              ?.map((result) => result.alternatives?.[0]?.transcript)
              .filter(Boolean)
              .join("\n");
            if (resultTranscript) {
              transcripts.push(resultTranscript);
            }
          }
          transcript = transcripts.join("\n");
        }

        console.log(
          `[Transcribe] BatchRecognize 완료: ${transcript?.length ?? 0}자`
        );
      } finally {
        // GCS 임시 파일 삭제
        try {
          await gcsFile.delete();
          console.log(`[Transcribe] GCS 임시 파일 삭제 완료`);
        } catch (deleteError) {
          console.warn(`[Transcribe] GCS 임시 파일 삭제 실패:`, deleteError);
        }
      }
    } else {
      // GCS 미설정: 인라인 recognize (1분 미만)
      console.log(
        `[Transcribe] Recognize 사용 (${Math.round(buffer.length / 1024)}KB)`
      );

      const [response] = await speechClient.recognize({
        recognizer,
        config,
        content: buffer,
      });

      transcript = response.results
        ?.map((result) => result.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join("\n");

      console.log(
        `[Transcribe] Recognize 완료: ${transcript?.length ?? 0}자`
      );
    }

    if (!transcript?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "전사 결과가 비어있습니다. 오디오에 음성이 포함되어 있는지 확인해주세요.",
        },
        { status: 400 }
      );
    }

    console.log(`[Transcribe] 성공: ${transcript.length}자`);

    return NextResponse.json({
      success: true,
      data: { transcript },
    });
  } catch (error) {
    console.error("[Transcribe] 전사 실패:", error);
    if (error instanceof Error) {
      console.error("[Transcribe] Stack:", error.stack);
    }
    const message =
      error instanceof Error ? error.message : "전사 중 오류가 발생했습니다";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
