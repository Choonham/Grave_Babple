import {call, put} from 'redux-saga/effects';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {startLoading, stopLoading} from '../utils/createRequestActionTypes';

/**
 * 제네릭 요청 사가 팩토리 함수
 * API 요청, 로딩 상태 관리, 콜백 처리를 자동화합니다.
 *
 * @param type 액션 타입
 * @param apiFunction API 함수
 * @returns 사가 함수
 */
export const createRequestSaga = (type: string, apiFunction: any) => {
  return function* (action: any) {
    // 로딩 시작
    yield put(startLoading(type));

    try {
      // API 함수 호출
      const response = yield call(apiFunction, action.payload);

      // 로그인 성공 시 토큰 저장
      if (type === 'userState/USER_LOGIN' && response.data && response.data.token) {
        try {
          yield call(AsyncStorage.setItem, 'accessToken', response.data.token);
          console.log('✅ [로그인] 토큰 저장 완료');
          
          // 사용자 정보도 저장 (선택사항)
          if (response.data.user) {
            yield call(AsyncStorage.setItem, 'userInfo', JSON.stringify(response.data.user));
            if (response.data.user.location) {
              yield call(
                AsyncStorage.setItem,
                'userLocation',
                JSON.stringify({
                  latitude: response.data.user.location.latitude,
                  longitude: response.data.user.location.longitude,
                  locationText:
                    response.data.user.location_text ||
                    response.data.user.locationText ||
                    null,
                }),
              );
            } else {
              yield call(AsyncStorage.removeItem, 'userLocation');
            }
          }
        } catch (storageError) {
          console.error('❌ [로그인] 토큰 저장 실패:', storageError);
        }
      }


      // 성공 액션 디스패치
      yield put({
        type: `${type}_SUCCESS`,
        payload: response.data,
      });

      // 성공 콜백 실행
      if (action.callbacks && action.callbacks.onSuccess) {
        action.callbacks.onSuccess(response.data);
      }
    } catch (error) {
      // 실패 액션 디스패치
      yield put({
        type: `${type}_FAILURE`,
        payload: error,
      });

      // 실패 콜백 실행
      if (action.callbacks && action.callbacks.onFailure) {
        action.callbacks.onFailure(error);
      }
    } finally {
      // 로딩 종료
      yield put(stopLoading(type));
    }
  };
};

/**
 * 안전한 액션 사가 팩토리 함수
 * 오프라인 환경에서도 안전하게 동작하는 사가를 생성합니다.
 *
 * @param type 액션 타입
 * @param safeFunction 안전한 함수 (오프라인에서도 동작)
 * @returns 사가 함수
 */
export const createSafeSaga = (type: string, safeFunction: any) => {
  return function* (action: any) {
    try {
      const result = yield call(safeFunction, action.payload);

      // 성공 액션 디스패치
      yield put({
        type: `${type}_SUCCESS`,
        payload: result,
      });

      // 성공 콜백 실행
      if (action.callbacks && action.callbacks.onSuccess) {
        action.callbacks.onSuccess(result);
      }
    } catch (error) {
      // 실패 액션 디스패치
      yield put({
        type: `${type}_FAILURE`,
        payload: error,
      });

      // 실패 콜백 실행
      if (action.callbacks && action.callbacks.onFailure) {
        action.callbacks.onFailure(error);
      }
    }
  };
};
