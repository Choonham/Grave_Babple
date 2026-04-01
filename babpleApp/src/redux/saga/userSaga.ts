import {takeLatest} from 'redux-saga/effects';
import {createRequestSaga} from './createRequestSaga';
import {AuthAPI} from '../../api/ApiRequests';
import {
  USER_LOGIN,
  USER_REGISTER,
  USER_LOGOUT,
  USER_PROFILE_UPDATE,
  USER_LOCATION_UPDATE,
} from '../states/userState';

/**
 * 사용자 관련 사가들
 */

// 로그인 사가
const userLoginSaga = createRequestSaga(USER_LOGIN, AuthAPI.login);

// 회원가입 사가
const userRegisterSaga = createRequestSaga(USER_REGISTER, AuthAPI.register);

// 로그아웃 사가
const userLogoutSaga = createRequestSaga(USER_LOGOUT, AuthAPI.logout);

// 프로필 업데이트 사가
const userProfileUpdateSaga = createRequestSaga(
  USER_PROFILE_UPDATE,
  AuthAPI.updateProfile,
);

// 위치 업데이트 사가
const userLocationUpdateSaga = createRequestSaga(
  USER_LOCATION_UPDATE,
  AuthAPI.updateLocation,
);

/**
 * 사용자 상태 사가 루트 함수
 * 모든 사용자 관련 액션을 감시하고 처리합니다.
 */
export function* userSaga() {
  yield takeLatest(USER_LOGIN, userLoginSaga);
  yield takeLatest(USER_REGISTER, userRegisterSaga);
  yield takeLatest(USER_LOGOUT, userLogoutSaga);
  yield takeLatest(USER_PROFILE_UPDATE, userProfileUpdateSaga);
  yield takeLatest(USER_LOCATION_UPDATE, userLocationUpdateSaga);
}
