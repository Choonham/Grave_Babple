import {START_LOADING, STOP_LOADING} from '../utils/createRequestActionTypes';

/**
 * 로딩 상태 인터페이스
 */
export interface LoadingState {
  isLoading: boolean; // 현재 로딩 중인지 여부
  reqName: string; // 현재 로딩 중인 요청 이름
}

/**
 * 로딩 상태 초기값
 */
const initialState: LoadingState = {
  isLoading: false,
  reqName: '',
};

/**
 * 로딩 상태 리듀서
 * 전역 로딩 상태를 관리합니다.
 *
 * @param state 현재 상태
 * @param action 디스패치된 액션
 * @returns 새로운 상태
 */
export default function loadingState(
  state: LoadingState = initialState,
  action: any,
): LoadingState {
  switch (action.type) {
    case START_LOADING:
      return {
        ...state,
        isLoading: true,
        reqName: action.payload,
      };

    case STOP_LOADING:
      return {
        ...state,
        isLoading: false,
        reqName: '',
      };

    default:
      return state;
  }
}
