import {combineReducers} from 'redux';
import {all, fork} from 'redux-saga/effects';

// 상태 모듈들 import
import loadingState from './states/loadingState';
import userState from './states/userState';
import postState from './states/postState';

// 사가들 import
import {userSaga} from './saga/userSaga';
import {postSaga} from './saga/postSaga';

/**
 * 루트 리듀서
 * 모든 상태 모듈을 결합합니다.
 */
export const rootReducer = combineReducers({
  loadingState, // 로딩 상태
  userState, // 사용자 상태
  postState, // 게시물 상태
});

/**
 * 루트 사가
 * 모든 사가를 결합하고 병렬로 실행합니다.
 */
export function* rootSaga() {
  yield all([
    fork(userSaga), // 사용자 관련 사가
    fork(postSaga), // 게시물 관련 사가
  ]);
}

// 루트 상태 타입 정의
export type RootState = ReturnType<typeof rootReducer>;
