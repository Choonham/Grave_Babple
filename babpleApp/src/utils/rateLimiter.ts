import {useRef} from 'react';

/**
 * Rate Limiter Hook
 * API 요청의 빈도를 제한하여 429 에러를 방지합니다.
 * 
 * @param minInterval 최소 요청 간격 (밀리초, 기본값: 2000ms)
 * @returns rate limit 체크 함수
 */
export const useRateLimiter = (minInterval: number = 2000) => {
  const fetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  /**
   * 요청이 가능한지 확인
   * @returns 요청 가능하면 true, 아니면 false
   */
  const canFetch = (): boolean => {
    // 이미 요청 중이면 스킵
    if (fetchingRef.current) {
      return false;
    }

    // 최소 간격 이내에 요청했으면 스킵
    const now = Date.now();
    if (now - lastFetchTimeRef.current < minInterval) {
      return false;
    }

    return true;
  };

  /**
   * 요청 시작 (내부적으로 호출)
   */
  const startFetch = (): void => {
    fetchingRef.current = true;
    lastFetchTimeRef.current = Date.now();
  };

  /**
   * 요청 완료 (내부적으로 호출)
   */
  const endFetch = (): void => {
    fetchingRef.current = false;
  };

  /**
   * Rate limit이 적용된 함수 실행
   * @param fn 실행할 함수
   * @returns Promise 또는 void
   */
  const execute = async <T>(fn: () => Promise<T> | T): Promise<T | null> => {
    if (!canFetch()) {
      return null;
    }

    try {
      startFetch();
      return await fn();
    } finally {
      endFetch();
    }
  };

  return {
    canFetch,
    execute,
    startFetch,
    endFetch,
  };
};

