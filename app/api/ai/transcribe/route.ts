import { NextRequest, NextResponse } from "next/server";
import {
  loadGcpServiceAccount,
  loadGcsBucketName,
} from "@/lib/gcp-service-account";
import { getSelectedPhrases } from "@/lib/phrase-sets";
import { v2 } from "@google-cloud/speech";

// chirp_3는 "us" 멀티 리전에서 모든 피처(화자 분리 포함) 지원이 확인됨
const LOCATION = "us";

interface WordInfo {
  word?: string | null;
  speakerLabel?: string | null;
}

/**
 * 화자 분리된 단어 목록을 "화자 N: 텍스트" 형식으로 조합
 */
function formatDiarizedTranscript(words: WordInfo[]): string {
  const lines: string[] = [];
  let currentSpeaker = "";
  let currentText = "";

  for (const w of words) {
    const speaker = w.speakerLabel || "";
    const word = w.word || "";
    if (!word) continue;

    if (speaker !== currentSpeaker) {
      if (currentText) {
        lines.push(`화자 ${currentSpeaker}: ${currentText.trim()}`);
      }
      currentSpeaker = speaker;
      currentText = word;
    } else {
      currentText += " " + word;
    }
  }
  if (currentText) {
    lines.push(`화자 ${currentSpeaker}: ${currentText.trim()}`);
  }
  return lines.join("\n");
}

/**
 * POST /api/ai/transcribe
 * 오디오 파일을 텍스트로 전사 (Speech-to-Text V2 + Chirp 3)
 * FormData: audio (File), enableDiarization ("true" | "false")
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
    const enableDiarization = formData.get("enableDiarization") === "true";

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "오디오 파일이 없습니다" },
        { status: 400 }
      );
    }

    console.log(
      `[Transcribe] 파일: ${audioFile.name}, 타입: ${audioFile.type}, 크기: ${Math.round(audioFile.size / 1024)}KB, 화자분리: ${enableDiarization}`
    );

    const credentials = {
      client_email: sa.client_email,
      private_key: sa.private_key,
    };

    // V2 SpeechClient (멀티 리전 엔드포인트 사용)
    const speechClient = new v2.SpeechClient({
      credentials,
      projectId: sa.project_id,
      apiEndpoint: `${LOCATION}-speech.googleapis.com`,
    });

    // File → Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const recognizer = `projects/${sa.project_id}/locations/${LOCATION}/recognizers/_`;

    // V2 인식 설정 (Chirp 3 + 인코딩 자동 감지)
    // chirp_3 화자 분리는 빈 diarizationConfig 사용 (자동 화자 수 감지)
    const phrases = await getSelectedPhrases();
    const config: Record<string, unknown> = {
      autoDecodingConfig: {},
      languageCodes: ["ko-KR"],
      model: "chirp_3",
      features: {
        ...(enableDiarization && {
          diarizationConfig: {},
        }),
      },
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

        if (!operation.name) {
          throw new Error("BatchRecognize operation 생성 실패: operation name이 없습니다");
        }

        console.log(`[Transcribe] BatchRecognize operation: ${operation.name}`);

        // operation.promise() 대신 수동 폴링 (Node.js V2 클라이언트의 hang 방지)
        const POLL_INTERVAL_MS = 5_000;
        const MAX_POLL_MS = 600_000; // 10분 타임아웃
        const startTime = Date.now();
        let pollResult = await speechClient.checkBatchRecognizeProgress(operation.name);

        while (!pollResult.done) {
          if (Date.now() - startTime > MAX_POLL_MS) {
            throw new Error("BatchRecognize 타임아웃 (10분 초과). 오디오 파일이 너무 크거나 서비스가 지연되고 있습니다.");
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          pollResult = await speechClient.checkBatchRecognizeProgress(operation.name!);
        }

        // pollResult.result의 타입이 {}로 추론되므로 타입 단언 필요
        // (google-gax LROperation의 result 프로퍼티 타입 정의 한계)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = pollResult.result as any;

        // batchRecognize 응답: results 맵에서 transcript 추출
        const inlineResults = response?.results;
        if (inlineResults) {
          // 파일별 에러 체크
          for (const [uri, fileResult] of Object.entries(inlineResults)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fr = fileResult as any;
            if (fr.error?.message) {
              console.error(`[Transcribe] 파일 에러 (${uri}): ${fr.error.message}`);
              throw new Error(fr.error.message);
            }
          }

          if (enableDiarization) {
            // 화자 분리: 모든 결과에서 words를 모아서 화자별로 조합
            const allWords: WordInfo[] = [];
            for (const [, fileResult] of Object.entries(inlineResults)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fr = fileResult as any;
              for (const result of fr.transcript?.results ?? []) {
                const words = result.alternatives?.[0]?.words;
                if (words) {
                  allWords.push(...(words as WordInfo[]));
                }
              }
            }
            transcript = allWords.length > 0
              ? formatDiarizedTranscript(allWords)
              : undefined;
          } else {
            const transcripts: string[] = [];
            for (const [, fileResult] of Object.entries(inlineResults)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fr = fileResult as any;
              const resultTranscript = fr.transcript?.results
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ?.map((result: any) => result.alternatives?.[0]?.transcript)
                .filter(Boolean)
                .join("\n");
              if (resultTranscript) {
                transcripts.push(resultTranscript);
              }
            }
            transcript = transcripts.join("\n");
          }
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

      if (enableDiarization) {
        // 화자 분리: words에서 speakerLabel 추출
        const allWords: WordInfo[] = [];
        for (const result of response.results ?? []) {
          const words = result.alternatives?.[0]?.words;
          if (words) {
            allWords.push(...(words as WordInfo[]));
          }
        }
        transcript = allWords.length > 0
          ? formatDiarizedTranscript(allWords)
          : undefined;
      } else {
        transcript = response.results
          ?.map((result) => result.alternatives?.[0]?.transcript)
          .filter(Boolean)
          .join("\n");
      }

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
