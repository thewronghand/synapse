/**
 * 파일별 Lock 관리
 * 동일 파일에 대한 동시 쓰기를 방지하기 위한 mutex 구현
 */

type LockRelease = () => void;

interface LockEntry {
  promise: Promise<void>;
  resolve: () => void;
}

class FileLockManager {
  private locks: Map<string, LockEntry[]> = new Map();

  /**
   * 특정 파일에 대한 락 획득
   * @param key 락 식별자 (파일 경로 또는 문서 제목)
   * @returns 락 해제 함수
   */
  async acquire(key: string): Promise<LockRelease> {
    const normalizedKey = key.normalize("NFC").toLowerCase();

    // 현재 대기 중인 락들 가져오기
    const queue = this.locks.get(normalizedKey) || [];

    // 새 락 엔트리 생성
    let resolveFunc: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      resolveFunc = resolve;
    });

    const entry: LockEntry = {
      promise: lockPromise,
      resolve: resolveFunc,
    };

    // 큐에 추가
    queue.push(entry);
    this.locks.set(normalizedKey, queue);

    // 이전 락들이 모두 해제될 때까지 대기
    const myIndex = queue.length - 1;
    if (myIndex > 0) {
      // 이전 모든 락이 해제될 때까지 대기
      await Promise.all(queue.slice(0, myIndex).map(e => e.promise));
    }

    console.log(`[FileLock] Acquired lock for: ${normalizedKey}`);

    // 락 해제 함수 반환
    return () => {
      console.log(`[FileLock] Released lock for: ${normalizedKey}`);

      // 현재 락 해제
      entry.resolve();

      // 큐에서 제거
      const currentQueue = this.locks.get(normalizedKey);
      if (currentQueue) {
        const idx = currentQueue.indexOf(entry);
        if (idx !== -1) {
          currentQueue.splice(idx, 1);
        }

        // 큐가 비면 맵에서 제거
        if (currentQueue.length === 0) {
          this.locks.delete(normalizedKey);
        }
      }
    };
  }

  /**
   * 락을 획득하고 작업 수행 후 자동으로 해제
   * @param key 락 식별자
   * @param fn 실행할 작업
   */
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire(key);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * 현재 락 상태 확인 (디버깅용)
   */
  getStatus(): { key: string; queueLength: number }[] {
    const status: { key: string; queueLength: number }[] = [];
    this.locks.forEach((queue, key) => {
      status.push({ key, queueLength: queue.length });
    });
    return status;
  }
}

// 싱글톤 인스턴스
export const fileLock = new FileLockManager();
