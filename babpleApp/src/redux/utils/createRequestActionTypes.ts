/**
 * Redux 액션 타입 생성 유틸리티
 * 요청, 성공, 실패 액션 타입을 자동으로 생성합니다.
 *
 * @param name 액션 이름 (예: 'userState/USER_LOGIN')
 * @returns [REQUEST, SUCCESS, FAILURE] 액션 타입 배열
 */
export const createRequestActionTypes = (name: string) => [
  `${name}`,
  `${name}_SUCCESS`,
  `${name}_FAILURE`,
];

/**
 * 콜백 인터페이스 정의
 * API 요청 시 성공/실패 콜백을 처리하기 위한 인터페이스
 */
export interface Callbacks {
  onSuccess?: (data: any) => void;
  onFailure?: (error: any) => void;
}

/**
 * 요청 액션 생성 유틸리티
 * API 요청을 위한 표준 액션을 생성합니다.
 *
 * @param type 액션 타입
 * @param params 요청 파라미터
 * @param callbacks 성공/실패 콜백
 * @returns Redux 액션 객체
 */
export const createRequestAction = (
  type: string,
  params: any,
  callbacks: Callbacks,
) => ({
  type,
  payload: params,
  callbacks,
});

/**
 * 로딩 상태 액션 타입들
 */
export const START_LOADING = 'loadingState/START_LOADING';
export const STOP_LOADING = 'loadingState/STOP_LOADING';

/**
 * 로딩 시작 액션 생성자
 * @param reqName 요청 이름 (로딩 상태 식별용)
 */
export const startLoading = (reqName: string) => ({
  type: START_LOADING,
  payload: reqName,
});

/**
 * 로딩 종료 액션 생성자
 * @param reqName 요청 이름 (로딩 상태 식별용)
 */
export const stopLoading = (reqName: string) => ({
  type: STOP_LOADING,
  payload: reqName,
});
