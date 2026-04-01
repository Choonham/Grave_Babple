import {
  createRequestActionTypes,
  createRequestAction,
  Callbacks,
} from '../utils/createRequestActionTypes';

/**
 * 사용자 정보 인터페이스
 */
export interface UserInfo {
  user_id: string;
  email: string;
  nickname: string;
  profile_image_url?: string;
  introduction?: string;
  social_provider?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  };
  location_text?: string;
  age_group?: string;
  gender?: string;
  role: number;
  is_push_notification_enabled: boolean;
  store_id?: string;
  created_at: string;
  updated_at: string;
  view_mode?: number;
}

/**
 * 사용자 상태 인터페이스
 */
export interface UserState {
  isAuthenticated: boolean; // 인증 상태
  userInfo: UserInfo | null; // 사용자 정보
  loginError: string | null; // 로그인 에러 메시지
  registerError: string | null; // 회원가입 에러 메시지
  registerInProgress: {
    userId: string | null; // 회원가입 진행 중인 user_id
    email: string | null; // 회원가입 진행 중인 email
  } | null; // 회원가입 진행 상태
}

/**
 * 액션 타입 정의
 */
const [USER_LOGIN, USER_LOGIN_SUCCESS, USER_LOGIN_FAILURE] =
  createRequestActionTypes('userState/USER_LOGIN');

const [USER_REGISTER, USER_REGISTER_SUCCESS, USER_REGISTER_FAILURE] =
  createRequestActionTypes('userState/USER_REGISTER');

const [USER_LOGOUT, USER_LOGOUT_SUCCESS, USER_LOGOUT_FAILURE] =
  createRequestActionTypes('userState/USER_LOGOUT');

const [
  USER_PROFILE_UPDATE,
  USER_PROFILE_UPDATE_SUCCESS,
  USER_PROFILE_UPDATE_FAILURE,
] = createRequestActionTypes('userState/USER_PROFILE_UPDATE');

const [
  USER_LOCATION_UPDATE,
  USER_LOCATION_UPDATE_SUCCESS,
  USER_LOCATION_UPDATE_FAILURE,
] = createRequestActionTypes('userState/USER_LOCATION_UPDATE');

// 회원가입 진행 상태 관리 액션
export const SET_REGISTER_IN_PROGRESS = 'userState/SET_REGISTER_IN_PROGRESS';
export const CLEAR_REGISTER_IN_PROGRESS = 'userState/CLEAR_REGISTER_IN_PROGRESS';

/**
 * 액션 생성자들
 */

/**
 * 사용자 로그인 액션 생성자
 * @param email 이메일
 * @param password 비밀번호
 * @param fcmToken FCM 토큰 (푸시 알림용)
 * @param deviceId 디바이스 ID
 * @param callbacks 성공/실패 콜백
 */
export const userLogin = (
  email: string,
  password: string,
  fcmToken: string,
  deviceId: string,
  location:
    | {
        latitude: number;
        longitude: number;
        locationText?: string | null;
      }
    | null
    | undefined,
  callbacks: Callbacks,
) => {
  const payload: any = {
    email,
    password,
    fcmToken,
    deviceId,
  };

  if (
    location &&
    typeof location.latitude === 'number' &&
    !Number.isNaN(location.latitude) &&
    typeof location.longitude === 'number' &&
    !Number.isNaN(location.longitude)
  ) {
    payload.latitude = location.latitude;
    payload.longitude = location.longitude;
    if (location.locationText && location.locationText.trim().length > 0) {
      payload.location_text = location.locationText.trim();
    }
  }

  return createRequestAction(
    USER_LOGIN,
    payload,
    callbacks,
  );
};

/**
 * 사용자 회원가입 액션 생성자
 * @param email 이메일
 * @param password 비밀번호
 * @param nickname 닉네임
 * @param callbacks 성공/실패 콜백
 */
export const userRegister = (
  email: string,
  password: string,
  nickname: string,
  callbacks: Callbacks,
) => {
  return createRequestAction(
    USER_REGISTER,
    {
      email,
      password,
      nickname,
    },
    callbacks,
  );
};

/**
 * 사용자 로그아웃 액션 생성자
 * @param callbacks 성공/실패 콜백
 */
export const userLogout = (callbacks: Callbacks) => {
  return createRequestAction(USER_LOGOUT, {}, callbacks);
};

/**
 * 사용자 프로필 업데이트 액션 생성자
 * @param profileData 업데이트할 프로필 데이터
 * @param callbacks 성공/실패 콜백
 */
export const userProfileUpdate = (
  profileData: Partial<UserInfo>,
  callbacks: Callbacks,
) => {
  return createRequestAction(USER_PROFILE_UPDATE, profileData, callbacks);
};

/**
 * 사용자 위치 업데이트 액션 생성자
 * @param location 위치 정보
 * @param locationText 위치 텍스트
 * @param callbacks 성공/실패 콜백
 */
export const userLocationUpdate = (
  location: {latitude: number; longitude: number},
  locationText: string,
  callbacks: Callbacks,
) => {
  return createRequestAction(
    USER_LOCATION_UPDATE,
    {
      location,
      locationText,
    },
    callbacks,
  );
};

/**
 * 회원가입 진행 상태 설정 액션 생성자
 * @param userId user_id
 * @param email 이메일
 */
export const setRegisterInProgress = (userId: string, email: string) => {
  return {
    type: SET_REGISTER_IN_PROGRESS,
    payload: {userId, email},
  };
};

/**
 * 회원가입 진행 상태 초기화 액션 생성자
 */
export const clearRegisterInProgress = () => {
  return {
    type: CLEAR_REGISTER_IN_PROGRESS,
  };
};

/**
 * 사용자 상태 초기값
 */
const initialState: UserState = {
  isAuthenticated: false,
  userInfo: null,
  loginError: null,
  registerError: null,
  registerInProgress: null,
};

/**
 * 사용자 상태 리듀서
 * 사용자 인증 및 프로필 정보를 관리합니다.
 *
 * @param state 현재 상태
 * @param action 디스패치된 액션
 * @returns 새로운 상태
 */
export default function userState(
  state: UserState = initialState,
  action: any,
): UserState {
  switch (action.type) {
    // 로그인 요청
    case USER_LOGIN:
      return {
        ...state,
        loginError: null,
      };

    // 로그인 성공
    case USER_LOGIN_SUCCESS:
      // 응답 데이터에서 user 정보 추출 (백엔드 응답 구조에 맞춤)
      const userData = action.payload?.user || action.payload;
      return {
        ...state,
        isAuthenticated: true,
        userInfo: userData,
        loginError: null,
      };

    // 로그인 실패
    case USER_LOGIN_FAILURE:
      console.log('USER_LOGIN_FAILURE!!');
      console.log(action.payload);
      // axios 에러 응답 구조 처리
      const errorMessage = 
        action.payload?.response?.data?.message ||
        action.payload?.message ||
        '로그인에 실패했습니다.';
      return {
        ...state,
        isAuthenticated: false,
        userInfo: null,
        loginError: errorMessage,
      };

    // 회원가입 요청
    case USER_REGISTER:
      return {
        ...state,
        registerError: null,
      };

    // 회원가입 성공
    case USER_REGISTER_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        userInfo: action.payload,
        registerError: null,
      };

    // 회원가입 실패
    case USER_REGISTER_FAILURE:
      console.log('USER_REGISTER_FAILURE!!');
      console.log(action.payload);
      return {
        ...state,
        registerError: action.payload?.message || '회원가입에 실패했습니다.',
      };

    // 로그아웃 성공
    case USER_LOGOUT_SUCCESS:
      return {
        ...state,
        isAuthenticated: false,
        userInfo: null,
        loginError: null,
        registerError: null,
      };

    // 프로필 업데이트 성공
    case USER_PROFILE_UPDATE_SUCCESS:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          ...action.payload,
        } as UserInfo,
      };

    // 위치 업데이트 성공
    case USER_LOCATION_UPDATE_SUCCESS:
      return {
        ...state,
        userInfo: state.userInfo
          ? {
              ...state.userInfo,
              location: action.payload.location,
              location_text: action.payload.locationText,
            }
          : null,
      };

    // 회원가입 진행 상태 설정
    case SET_REGISTER_IN_PROGRESS:
      return {
        ...state,
        registerInProgress: action.payload,
      };

    // 회원가입 진행 상태 초기화
    case CLEAR_REGISTER_IN_PROGRESS:
      return {
        ...state,
        registerInProgress: null,
      };

    default:
      return state;
  }
}

// 액션 타입들을 외부에서 사용할 수 있도록 export
export {
  USER_LOGIN,
  USER_LOGIN_SUCCESS,
  USER_LOGIN_FAILURE,
  USER_REGISTER,
  USER_REGISTER_SUCCESS,
  USER_REGISTER_FAILURE,
  USER_LOGOUT,
  USER_LOGOUT_SUCCESS,
  USER_LOGOUT_FAILURE,
  USER_PROFILE_UPDATE,
  USER_PROFILE_UPDATE_SUCCESS,
  USER_PROFILE_UPDATE_FAILURE,
  USER_LOCATION_UPDATE,
  USER_LOCATION_UPDATE_SUCCESS,
  USER_LOCATION_UPDATE_FAILURE,
};
