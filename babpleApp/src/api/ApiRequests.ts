import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINT } from '../config/api';

/**
 * API 클라이언트 설정
 */
class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor() {
    // 환경에 따라 다른 백엔드 URL 사용
    // - 로컬 Docker: http://choonhost.zapto.org/api (Nginx를 통해)
    // - 서버: http://babpleTest.slowFlowSoft.com:3000/api
    this.baseURL = API_ENDPOINT;

    // 개발 모드에서만 초기화 로그 출력
    if (__DEV__) {
      console.log('📱 [API 클라이언트] 초기화');
      console.log('📱 [API 클라이언트] Base URL:', this.baseURL);
    }

    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 60000, // 60초 타임아웃 (레시피 이미지 업로드 대응)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 요청 인터셉터 - 토큰 자동 추가 및 로깅
    this.instance.interceptors.request.use(
      async config => {
        // AI 분석 요청은 데이터가 너무 크므로 로그 축소
        const isAIAnalyze = config.url?.includes('ai-analyze');

        if (__DEV__) {
          console.log('📤 [API 요청]', config.method?.toUpperCase(), config.url);
          if (!isAIAnalyze) {
            console.log('📤 [API 요청] 데이터:', config.data);
          } else {
            console.log('📤 [API 요청] AI 분석 요청 (데이터 크기 축소 로그)');
          }
        }

        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            if (__DEV__ && !isAIAnalyze) {
              console.log('📤 [API 요청] 토큰 추가됨');
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.log('❌ [API 요청] 토큰 로드 실패:', error);
          }
        }
        return config;
      },
      error => {
        console.error('❌ [API 요청] 인터셉터 오류:', error);
        return Promise.reject(error);
      },
    );

    // 응답 인터셉터 - 에러 처리 및 로깅
    this.instance.interceptors.response.use(
      response => {
        const isAIAnalyze = response.config.url?.includes('ai-analyze');

        if (__DEV__) {
          console.log('📥 [API 응답]', response.config.method?.toUpperCase(), response.config.url);
          console.log('📥 [API 응답] 상태:', response.status);
          if (!isAIAnalyze) {
            console.log('📥 [API 응답] 데이터:', JSON.stringify(response.data, null, 2));
          } else {
            console.log('📥 [API 응답] AI 분석 완료');
          }
        }
        return response;
      },
      async error => {
        console.error('❌ [API 응답] 오류 발생');
        console.error('❌ [API 응답] URL:', error.config?.url);
        console.error('❌ [API 응답] 메서드:', error.config?.method);
        console.error('❌ [API 응답] 상태:', error.response?.status);
        console.error('❌ [API 응답] 메시지:', error.message);
        console.error('❌ [API 응답] 응답 데이터:', error.response?.data);

        if (error.code === 'ECONNREFUSED') {
          console.error('❌ [API 응답] 연결 거부됨 - 서버가 실행 중인지 확인하세요');
          console.error('❌ [API 응답] Base URL:', this.baseURL);
        }

        if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
          console.error('❌ [API 응답] 네트워크 오류 - 인터넷 연결 및 서버 상태를 확인하세요');
        }

        if (error.response?.status === 401) {
          // 토큰 만료 시 로그아웃 처리
          await AsyncStorage.removeItem('accessToken');
          await AsyncStorage.removeItem('refreshToken');
          // 로그인 화면으로 리다이렉트 로직 추가 필요
        }

        // 413 Payload Too Large 에러 처리
        if (error.response?.status === 413) {
          const errorMessage = error.response?.data?.message || '업로드하려는 파일의 용량이 너무 큽니다. 최대 100MB까지 업로드 가능합니다. 이미지 압축을 시도해보세요.';
          // 에러 객체에 사용자 친화적 메시지 추가
          error.userMessage = errorMessage;
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * GET 요청
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.get(url, config);
    return response.data;
  }

  /**
   * POST 요청
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.post(
      url,
      data,
      config,
    );
    return response.data;
  }

  /**
   * PUT 요청
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.put(
      url,
      data,
      config,
    );
    return response.data;
  }

  /**
   * DELETE 요청
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.delete(url, config);
    return response.data;
  }

  /**
   * 파일 업로드 요청
   */
  async upload<T = any>(
    url: string,
    formData: FormData,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    });
    return response.data;
  }
}

// API 클라이언트 인스턴스 생성
const apiClient = new ApiClient();

/**
 * 약관 정보 타입
 */
export interface TermPolicy {
  id: number;
  title: string;
  content: string;
  required: boolean;
}

/**
 * 약관 동의 정보 타입
 */
export interface TermAgree {
  term_id: number;
  agreed: boolean;
}

/**
 * 사용자 인증 관련 API
 */
export const AuthAPI = {
  /**
   * 약관 정책 조회
   * GET /api/auth/terms/policies?type=0 또는 ?type=0,1
   * @param types 약관 타입 배열 (0: 일반, 1: 비즈니스). 없으면 모든 약관 반환
   */
  getTermsPolicies: async (types?: number[]): Promise<{ success: boolean; data: TermPolicy[] }> => {
    const params = types && types.length > 0 ? { type: types.join(',') } : {};
    return apiClient.get('/auth/terms/policies', { params });
  },

  /**
   * 기본 회원가입
   * POST /api/auth/register
   * 이메일, 비밀번호, 약관 동의만 받아서 처리
   * @param params 회원가입 파라미터
   */
  registerBasic: async (params: {
    email: string;
    password: string;
    terms: TermAgree[];
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      user_id: string;
      email: string;
    };
  }> => {
    return apiClient.post('/auth/register', params);
  },

  /**
   * 사업자 임시 계정 생성
   * POST /api/auth/register/biz-temp
   * 이메일, 비밀번호, 계정 유형, 약관 동의 정보를 받아서 임시 계정 생성
   * @param params 사업자 임시 계정 생성 파라미터
   */
  registerBizTemp: async (params: {
    email: string;
    password: string;
    account_type: 'mart' | 'advertiser';
    terms: TermAgree[];
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      user_id: string;
      email: string;
      role: number;
    };
  }> => {
    return apiClient.post('/auth/register/biz-temp', params);
  },

  /**
   * 회원가입 완료 (추가 정보 입력)
   * POST /api/auth/complete
   * 전화번호, 닉네임 등 부가 정보를 받아서 처리
   * @param params 완료 파라미터
   */
  completeRegistration: async (params: {
    user_id: string;
    nickname?: string;
    introduction?: string;
    phone_number?: string;
    gender?: string;
    age_group?: string;
    location_text?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      user_id: string;
      email: string;
      nickname: string;
      gender?: string;
      age_group?: string;
      location_text?: string;
    };
  }> => {
    return apiClient.post('/auth/complete', params);
  },

  /**
   * 사용자 로그인
   * @param params 로그인 파라미터
   */
  login: async (params: {
    email: string;
    password: string;
    fcmToken: string;
    deviceId: string;
    latitude?: number;
    longitude?: number;
    location_text?: string;
  }) => {
    return apiClient.post('/auth/login', params);
  },

  /**
   * 구글 로그인
   */
  loginWithGoogle: async (params: {
    idToken: string;
    fcmToken?: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
    location_text?: string;
  }) => {
    return apiClient.post('/auth/google', params);
  },

  /**
   * 애플 로그인
   */
  loginWithApple: async (params: {
    identityToken: string;
    authorizationCode?: string | null;
    user?: string;
    email?: string | null;
    fullName?: {
      givenName?: string | null;
      familyName?: string | null;
      middleName?: string | null;
      namePrefix?: string | null;
      nameSuffix?: string | null;
      nickname?: string | null;
    } | null;
    fcmToken?: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
    location_text?: string;
  }) => {
    return apiClient.post('/auth/apple', params);
  },

  /**
   * 카카오 로그인
   */
  loginWithKakao: async (params: {
    accessToken: string;
    fcmToken?: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
    location_text?: string;
  }) => {
    return apiClient.post('/auth/kakao', params);
  },

  /**
   * 네이버 로그인
   */
  loginWithNaver: async (params: {
    accessToken: string;
    fcmToken?: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
    location_text?: string;
  }) => {
    return apiClient.post('/auth/naver', params);
  },

  /**
   * 이메일 인증 코드 전송
   */
  requestEmailVerificationCode: async (params: { email: string; purpose?: string }) => {
    return apiClient.post('/auth/email/send-code', params);
  },

  /**
   * 이메일 인증 코드 확인
   */
  verifyEmailCode: async (params: { email: string; code: string; purpose?: string }) => {
    return apiClient.post('/auth/email/verify-code', params);
  },

  /**
   * 소셜 계정 연동 해제
   */
  unlinkSocialAccount: async (params: { provider: string; providerToken?: string }) => {
    return apiClient.post('/auth/social/unlink', params);
  },

  /**
   * 회원 탈퇴 요청
   */
  requestAccountDeletion: async (params: { password?: string; verificationCode?: string }) => {
    return apiClient.post('/auth/delete', params);
  },

  /**
   * 비밀번호 변경
   */
  changePassword: async (params: { newPassword: string; verificationCode: string }) => {
    return apiClient.post('/auth/password/change', params);
  },

  /**
   * 탈퇴 계정 정리 (관리자)
   */
  purgeDeletedUsers: async (adminSecret: string) => {
    return apiClient.post(
      '/auth/purge-deleted',
      {},
      {
        headers: {
          'x-admin-secret': adminSecret,
        },
      },
    );
  },

  /**
   * 탈퇴 계정 복구
   */
  restoreDeletedAccount: async (params: { userId: string }) => {
    return apiClient.post('/auth/restore-deleted', params);
  },

  /**
   * 사용자 로그아웃
   */
  logout: async () => {
    return apiClient.post('/auth/logout');
  },

  /**
   * 토큰 갱신
   * @param refreshToken 리프레시 토큰
   */
  refreshToken: async (refreshToken: string) => {
    return apiClient.post('/auth/refresh', { refreshToken });
  },

  /**
   * 사용자 프로필 조회
   */
  getProfile: async () => {
    return apiClient.get('/auth/profile');
  },

  /**
   * 사용자 프로필 업데이트
   * @param profileData 프로필 데이터
   */
  updateProfile: async (profileData: any) => {
    return apiClient.put('/auth/profile', profileData);
  },
};

/**
 * 게시물 관련 API
 */
export const PostAPI = {
  /**
   * 게시물 목록 조회
   * @param params 조회 파라미터
   */
  getPosts: async (params: {
    page?: number;
    limit?: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
    categories?: Array<{ type: number; category_id: number }>;
    keyword?: string;
  }) => {
    return apiClient.get('/posts', { params });
  },

  /**
   * 게시물 상세 조회
   * @param postId 게시물 ID
   */
  getPostDetail: async (postId: string) => {
    return apiClient.get(`/posts/${postId}`);
  },

  /**
   * 게시물 생성
   * @param postData 게시물 데이터
   */
  createPost: async (postData: any) => {
    return apiClient.post('/posts', postData);
  },

  /**
   * 게시물 수정
   * @param postId 게시물 ID
   * @param postData 수정할 게시물 데이터
   */
  updatePost: async (postId: string, postData: any) => {
    return apiClient.put(`/posts/${postId}`, postData);
  },

  /**
   * 게시물 삭제
   * @param postId 게시물 ID
   */
  deletePost: async (postId: string) => {
    return apiClient.delete(`/posts/${postId}`);
  },

  /**
   * 게시물 좋아요
   * @param postId 게시물 ID
   */
  likePost: async (postId: string) => {
    return apiClient.post(`/posts/${postId}/like`);
  },

  /**
   * 게시물 좋아요 취소
   * @param postId 게시물 ID
   */
  unlikePost: async (postId: string) => {
    return apiClient.delete(`/posts/${postId}/like`);
  },

  /**
   * 게시물 검색
   * @param searchCondition 검색 조건
   */
  searchPosts: async (searchCondition: any) => {
    return apiClient.post('/posts/search', searchCondition);
  },
};

/**
 * 파일 업로드 관련 API
 */
export const UploadAPI = {
  /**
   * 이미지 업로드
   * @param formData 이미지 FormData
   */
  uploadImage: async (formData: FormData) => {
    return apiClient.upload('/upload/image', formData);
  },

  /**
   * 다중 이미지 업로드
   * @param formData 이미지들 FormData
   */
  uploadImages: async (formData: FormData) => {
    return apiClient.upload('/upload/images', formData);
  },

  /**
   * 채팅 미디어 업로드 (이미지/비디오, 50MB 제한)
   * @param formData 미디어 FormData
   */
  uploadChatMedia: async (formData: FormData) => {
    return apiClient.upload('/upload/chat-media', formData);
  },
};

/**
 * 위치 관련 API
 */
export const LocationAPI = {
  /**
   * 사용자 위치 업데이트
   * @param locationData 위치 데이터
   */
  updateLocation: async (locationData: {
    latitude: number;
    longitude: number;
    locationText: string;
  }) => {
    return apiClient.put('/location', locationData);
  },

  /**
   * 주변 게시물 조회
   * @param params 위치 기반 조회 파라미터
   */
  getNearbyPosts: async (params: {
    latitude: number;
    longitude: number;
    radius: number;
    page?: number;
    limit?: number;
  }) => {
    return apiClient.get('/location/posts', { params });
  },
};

/**
 * 레시피 관련 API
 */
export const RecipeAPI = {
  createRecipe: async (recipeData: {
    title: string;
    description?: string;
    ingredients: Array<{ ingredient_id: number; quantity: number; unit: string }>;
    recipe_steps: Array<{
      step_number: number;
      instruction: string;
      image_base64?: string | null;
      image_uri?: string | null;
      video_base64?: string | null;
      video_uri?: string | null;
    }>;
    situation_id?: number;
    cooking_method_id?: number;
    main_ingredient_id?: number; // 단일 ID (하위 호환성)
    main_ingredient_ids?: number[]; // 배열 ID (새로운 방식)
    completed_images?: Array<{ base64: string | null; uri: string }>;
    location?: { latitude: number; longitude: number };
  }) => {
    // 레시피 등록은 이미지 업로드로 인해 시간이 오래 걸릴 수 있으므로 타임아웃 연장
    return apiClient.post('/recipes', recipeData, { timeout: 120000 }); // 120초 타임아웃
  },
  updateRecipe: async (
    recipePostId: string,
    recipeData: {
      title: string;
      description?: string;
      ingredients: Array<{ ingredient_id: number; quantity: number; unit: string }>;
      recipe_steps: Array<{
        step_number: number;
        instruction: string;
        image_base64?: string | null;
        image_uri?: string | null;
        video_base64?: string | null;
        video_uri?: string | null;
      }>;
      situation_id?: number;
      cooking_method_id?: number;
      main_ingredient_id?: number;
      main_ingredient_ids?: number[];
      completed_images?: Array<{ base64: string | null; uri: string }>;
      location?: { latitude: number; longitude: number };
    },
  ) => {
    // 레시피 수정도 이미지 업로드로 인해 시간이 오래 걸릴 수 있으므로 타임아웃 연장
    return apiClient.put(`/recipes/${recipePostId}`, recipeData, { timeout: 120000 }); // 120초 타임아웃
  },
  /**
   * 추천 레시피 조회
   * @param params 조회 파라미터
   */
  getRecommendations: async (params?: {
    situation_id?: number;
    cooking_method_id?: number;
    main_ingredient_id?: number;
    search?: string;
  }) => {
    const queryParams = params
      ? {
        ...(params.situation_id && { situation_id: params.situation_id }),
        ...(params.cooking_method_id && {
          cooking_method_id: params.cooking_method_id,
        }),
        ...(params.main_ingredient_id && {
          main_ingredient_id: params.main_ingredient_id,
        }),
        ...(params.search && { search: params.search }),
      }
      : {};
    return apiClient.get('/recipes/recommendations', { params: queryParams });
  },
  /**
   * AI 쉐프 이미지 분석
   * @param imageBase64 base64 인코딩된 이미지
   * @param mainIngredientNames 선택된 주재료 이름 배열 (선택사항)
   */
  analyzeImageWithAI: async (imageBase64: string, mainIngredientNames?: string[], recipeName?: string) => {
    // AI 분석은 시간이 오래 걸리므로 타임아웃을 60초로 설정
    return apiClient.post('/recipes/ai-analyze', {
      image_base64: imageBase64,
      main_ingredient_names: mainIngredientNames, // 주재료 이름들 전달
      recipe_name: recipeName, // 요리 이름 전달
    }, {
      timeout: 60000, // 60초 타임아웃 (AI 이미지 분석은 보통 10-30초 소요)
    });
  },
  /**
   * 레시피 상세 조회
   * @param recipePostId 레시피 ID
   */
  getRecipeDetail: async (recipePostId: string) => {
    return apiClient.get(`/recipes/${recipePostId}`);
  },
  getFeed: async () => {
    return apiClient.get('/recipes/feed');
  },

  /**
   * 레시피 카테고리 조회
   */
  getCategories: async () => {
    return apiClient.get('/recipes/categories');
  },

  /**
   * 레시피 기본 재료 조회
   * @param recipePostId 레시피 ID
   */
  getDefaultIngredients: async (recipePostId: string) => {
    return apiClient.get(`/recipes/${recipePostId}/default-ingredients`);
  },

  /**
   * 레시피 기본 스텝 조회
   * @param recipePostId 레시피 ID
   */
  getDefaultSteps: async (recipePostId: string) => {
    return apiClient.get(`/recipes/${recipePostId}/default-steps`);
  },
  deleteRecipe: async (recipePostId: string) => {
    return apiClient.delete(`/recipes/${recipePostId}`);
  },
  likeRecipe: async (recipePostId: string) => {
    return apiClient.post(`/recipes/${recipePostId}/like`);
  },
  unlikeRecipe: async (recipePostId: string) => {
    return apiClient.delete(`/recipes/${recipePostId}/like`);
  },
  createComment: async (
    recipePostId: string,
    params: { content: string; parent_comment_id?: string },
  ) => {
    return apiClient.post(`/recipes/${recipePostId}/comments`, params);
  },
  searchRecipes: async (keyword: string) => {
    return apiClient.get('/recipes/search', {
      params: { keyword },
    });
  },
  getLocalRanking: async (params?: { location_text?: string; limit?: number }) => {
    return apiClient.get('/recipes/local-ranking', {
      params,
    });
  },
  getRecentRandomRecipes: async (params?: { limit?: number }) => {
    return apiClient.get('/recipes/recent-random', {
      params,
    });
  },
  /**
   * 특정 재료를 주재료로 사용한 레시피 중 가장 좋아요가 많은 레시피 조회
   * @param ingredientId 재료 ID
   */
  getTopRecipeByMainIngredient: async (ingredientId: number) => {
    return apiClient.get(`/recipes/by-main-ingredient/${ingredientId}/top`);
  },
};

export const UserAPI = {
  /**
   * FCM 토큰 저장/업데이트
   * POST /api/users/fcm-token
   */
  updateFcmToken: async (fcmToken: string): Promise<{ success: boolean; message?: string }> => {
    return apiClient.post('/users/fcm-token', {
      fcm_token: fcmToken,
    });
  },

  /**
   * FCM 토큰 삭제 (로그아웃 시)
   * DELETE /api/users/fcm-token
   */
  deleteFcmToken: async (): Promise<{ success: boolean; message?: string }> => {
    return apiClient.delete('/users/fcm-token');
  },
  searchUsers: async (keyword: string) => {
    return apiClient.get('/users/search', {
      params: { keyword },
    });
  },
  /**
   * 내 프로필 정보 조회
   * GET /api/users/me/profile
   */
  getMyProfile: async () => {
    return apiClient.get('/users/me/profile');
  },
  /**
   * 내가 획득한 타이틀 리스트 조회
   * GET /api/users/me/titles
   */
  getMyTitles: async () => {
    return apiClient.get('/users/me/titles');
  },
  /**
   * 내가 등록한 레시피 리스트 조회
   * GET /api/users/me/recipes
   */
  getMyRecipes: async () => {
    return apiClient.get('/users/me/recipes');
  },
  /**
   * 내가 좋아요한 레시피 리스트 조회
   * GET /api/users/me/liked-recipes
   */
  getMyLikedRecipes: async () => {
    return apiClient.get('/users/me/liked-recipes');
  },
  /**
   * 다른 유저의 프로필 정보 조회
   * GET /api/users/:userId/profile
   */
  getUserProfile: async (userId: string) => {
    return apiClient.get(`/users/${userId}/profile`);
  },
  /**
   * 다른 유저가 등록한 레시피 리스트 조회
   * GET /api/users/:userId/recipes
   */
  getUserRecipes: async (userId: string) => {
    return apiClient.get(`/users/${userId}/recipes`);
  },
  /**
   * 다른 유저가 좋아요한 레시피 리스트 조회
   * GET /api/users/:userId/liked-recipes
   */
  getUserLikedRecipes: async (userId: string) => {
    return apiClient.get(`/users/${userId}/liked-recipes`);
  },
  /**
   * 유저 팔로우
   * POST /api/users/:userId/follow
   */
  followUser: async (userId: string) => {
    return apiClient.post(`/users/${userId}/follow`);
  },
  /**
   * 유저 언팔로우
   * DELETE /api/users/:userId/follow
   */
  unfollowUser: async (userId: string) => {
    return apiClient.delete(`/users/${userId}/follow`);
  },
  /**
   * 내 팔로워 리스트 조회 (나를 팔로우하는 사람들)
   * GET /api/users/me/followers
   */
  getMyFollowers: async () => {
    return apiClient.get('/users/me/followers');
  },
  /**
   * 내 팔로잉 리스트 조회 (내가 팔로우하는 사람들)
   * GET /api/users/me/following
   */
  getMyFollowing: async () => {
    return apiClient.get('/users/me/following');
  },
  /**
   * 특정 유저의 팔로워 리스트 조회 (해당 유저를 팔로우하는 사람들)
   * GET /api/users/:userId/followers
   */
  getUserFollowers: async (userId: string) => {
    return apiClient.get(`/users/${userId}/followers`);
  },
  /**
   * 특정 유저의 팔로잉 리스트 조회 (해당 유저가 팔로우하는 사람들)
   * GET /api/users/:userId/following
   */
  getUserFollowing: async (userId: string) => {
    return apiClient.get(`/users/${userId}/following`);
  },
  /**
   * 프로필 업데이트
   * PUT /api/users/me
   */
  updateProfile: async (profileData: {
    nickname?: string;
    introduction?: string;
    location_text?: string;
    latitude?: number;
    longitude?: number;
    profile_image_url?: string;
    view_mode?: number;
  }) => {
    return apiClient.put('/users/me', profileData);
  },
};

export const SearchAPI = {
  recordSearch: async (keyword: string, searchType?: string) => {
    return apiClient.post('/search/log', {
      keyword,
      search_type: searchType,
    });
  },
  getTrendingSearches: async (params?: { hours?: number; limit?: number }) => {
    return apiClient.get('/search/trending', {
      params,
    });
  },
};

/**
 * 지도 관련 API
 */
export const MapAPI = {
  /**
   * 지도 범위 내 레시피 조회
   * @param params 지도 경계 정보
   */
  getRecipes: async (params: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
    latitude?: number;
    longitude?: number;
    radius?: number;
  }) => {
    return apiClient.get('/maps/recipes', { params });
  },
};

/**
 * 재료 관련 API
 */
export const IngredientAPI = {
  /**
   * 재료 검색
   * @param searchKeyword 검색 키워드
   */
  searchIngredients: async (searchKeyword: string) => {
    return apiClient.get('/ingredients/search', {
      params: { search_keyword: searchKeyword },
    });
  },

  /**
   * 재료 추가
   * @param ingredient 재료 정보
   */
  createIngredient: async (ingredient: {
    name: string;
    sub_category_id?: number;
    default_unit?: string;
  }) => {
    return apiClient.post('/ingredients', ingredient);
  },
};

/**
 * 상점 관련 API
 */
export const StoreAPI = {
  /**
   * 상점 등록
   * POST /api/stores
   * @param params 상점 등록 파라미터
   */
  createStore: async (params: {
    user_id: string;
    name: string;
    biz_reg_no: string;
    owner?: string;
    address: string;
    detailed_address?: string;
    phone_number?: string;
    description?: string;
    operating_hours?: any;
    off_days?: any;
    latitude?: number;
    longitude?: number;
    profile_image_url?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      store_id: string;
      name: string;
    };
  }> => {
    return apiClient.post('/stores', params);
  },

  /**
   * 상점 목록 조회
   * @param params 조회 파라미터
   */
  getStores: async (params: {
    latitude?: number;
    longitude?: number;
    radius?: number;
    page?: number;
    limit?: number;
  }) => {
    return apiClient.get('/stores', { params });
  },

  /**
   * 상점 상세 조회
   * @param storeId 상점 ID
   */
  getStoreDetail: async (storeId: string) => {
    return apiClient.get(`/stores/${storeId}`);
  },

  /**
   * 가게 방문 수 증가
   * @param storeId 상점 ID
   */
  incrementStoreVisitCount: async (storeId: string): Promise<{
    success: boolean;
    data: {
      store_id: string;
      visit_count: number;
    };
  }> => {
    return apiClient.post(`/stores/${storeId}/visit`);
  },

  /**
   * 상점 프로모션 조회
   * @param storeId 상점 ID
   */
  getStorePromotions: async (storeId: string) => {
    return apiClient.get(`/stores/${storeId}/promotions`);
  },

  /**
   * 가게 전단지 목록 조회
   * @param storeId 상점 ID
   */
  getStoreFlyers: async (storeId: string) => {
    return apiClient.get(`/stores/${storeId}/flyers`);
  },

  /**
   * 가게 전단지 상세 조회
   * @param storeId 상점 ID
   * @param flyerId 전단지 ID
   */
  getStoreFlyer: async (storeId: string, flyerId: string) => {
    return apiClient.get(`/stores/${storeId}/flyers/${flyerId}`);
  },

  /**
   * 전단지 view_count 증가
   * @param flyerId 전단지 ID
   */
  incrementFlyerViewCount: async (flyerId: string): Promise<{
    success: boolean;
    data: {
      flyer_id: string;
      view_count: number;
    };
  }> => {
    return apiClient.post(`/stores/flyers/${flyerId}/view`);
  },

  /**
   * 내 상점 조회
   * GET /api/stores/me
   */
  getMyStore: async (): Promise<{
    success: boolean;
    message: string;
    data: {
      store_id: string;
      name: string;
      biz_reg_no: string;
      owner: string;
      address: string;
      phone_number: string;
      description: string;
      operating_hours: any;
      off_days: any;
      profile_image_url: string;
      visit_count: number;
      created_at: Date;
      latitude?: number | null;
      longitude?: number | null;
    };
  }> => {
    return apiClient.get('/stores/me');
  },

  /**
   * 내 상점 정보 수정
   * PUT /api/stores/me
   */
  updateStore: async (params: {
    name?: string;
    biz_reg_no?: string;
    owner?: string;
    address?: string;
    detailed_address?: string;
    phone_number?: string;
    description?: string;
    operating_hours?: any;
    off_days?: any;
    latitude?: number;
    longitude?: number;
    profile_image_url?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      store_id: string;
      name: string;
      biz_reg_no: string;
      owner: string;
      address: string;
      phone_number: string;
      description: string;
      operating_hours: any;
      off_days: any;
      profile_image_url: string;
    };
  }> => {
    return apiClient.put('/stores/me', params);
  },

  /**
   * 상점 대시보드 통계 조회
   * GET /api/stores/me/dashboard
   * @param days 기간 (7, 30, 90)
   */
  getStoreDashboardStats: async (days: number = 7): Promise<{
    success: boolean;
    data: {
      promotion_impressions: number;
      store_visits: number;
      flyer_views: number;
      biz_spent: number;
    };
  }> => {
    return apiClient.get('/stores/me/dashboard', { params: { days } });
  },

  /**
   * 내 상점의 진행 중인 프로모션 목록 조회
   * GET /api/stores/me/promotions/active
   */
  getMyStoreActivePromotions: async (): Promise<{
    success: boolean;
    data: Array<{
      promotion_id: string;
      title: string;
      description: string;
      image_url?: string;
      discount_value: number;
      valid_from: Date;
      valid_until: Date;
      days_left: number;
    }>;
  }> => {
    return apiClient.get('/stores/me/promotions/active');
  },

  /**
   * 전단지 등록
   * POST /api/stores/me/flyers
   */
  createFlyer: async (params: {
    title?: string;
    start_date: string;
    end_date: string;
    flyer_image_url: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      flyer_id: string;
      title: string | null;
      start_date: Date;
      end_date: Date;
      flyer_image_url: string;
    };
  }> => {
    return apiClient.post('/stores/me/flyers', params);
  },

  /**
   * 내 상점의 전단지 목록 조회
   * GET /api/stores/me/flyers
   */
  getMyFlyers: async (): Promise<{
    success: boolean;
    data: Array<{
      flyer_id: string;
      title: string | null;
      start_date: Date;
      end_date: Date;
      flyer_image_url: string;
      view_count: number;
      created_at: Date;
      is_active: boolean;
    }>;
  }> => {
    return apiClient.get('/stores/me/flyers');
  },

  /**
   * 전단지 상세 조회
   * GET /api/stores/me/flyers/:flyer_id
   */
  getFlyer: async (flyer_id: string): Promise<{
    success: boolean;
    data: {
      flyer_id: string;
      title: string | null;
      start_date: Date;
      end_date: Date;
      flyer_image_url: string;
      view_count: number;
      created_at: Date;
    };
  }> => {
    return apiClient.get(`/stores/me/flyers/${flyer_id}`);
  },

  /**
   * 전단지 수정
   * PUT /api/stores/me/flyers/:flyer_id
   */
  updateFlyer: async (
    flyer_id: string,
    params: {
      title?: string;
      start_date?: string;
      end_date?: string;
      flyer_image_url?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      flyer_id: string;
      title: string | null;
      start_date: Date;
      end_date: Date;
      flyer_image_url: string;
    };
  }> => {
    return apiClient.put(`/stores/me/flyers/${flyer_id}`, params);
  },

  /**
   * 전단지 삭제
   * DELETE /api/stores/me/flyers/:flyer_id
   */
  deleteFlyer: async (flyer_id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    return apiClient.delete(`/stores/me/flyers/${flyer_id}`);
  },

  /**
   * 재료 목록 조회 (프로모션 등록용)
   * GET /api/stores/ingredients
   */
  getIngredients: async (search?: string): Promise<{
    success: boolean;
    data: Array<{
      ingredient_id: number;
      name: string;
      default_unit: string | null;
    }>;
  }> => {
    return apiClient.get('/stores/ingredients', {
      params: search ? { search } : {},
    });
  },

  /**
   * 기획 상품 등록
   * POST /api/stores/me/promotions
   */
  createPromotion: async (params: {
    ingredient_id: number;
    title: string;
    description?: string;
    sale_price: number;
    original_price?: number;
    start_date: string;
    end_date: string;
    promotion_image_url: string;
    quantity?: number;
    quantity_unit?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      promotion_id: string;
      ingredient_id: number;
      title: string;
      description: string | null;
      sale_price: number;
      original_price: number | null;
      start_date: Date;
      end_date: Date;
      promotion_image_url: string;
      quantity: number | null;
      quantity_unit: string | null;
    };
  }> => {
    return apiClient.post('/stores/me/promotions', params);
  },

  /**
   * 내 상점의 프로모션 목록 조회
   * GET /api/stores/me/promotions
   */
  getMyPromotions: async (): Promise<{
    success: boolean;
    data: Array<{
      promotion_id: string;
      ingredient_id: number;
      ingredient_name: string | null;
      title: string;
      description: string | null;
      sale_price: number;
      original_price: number | null;
      start_date: Date;
      end_date: Date;
      promotion_image_url: string | null;
      quantity: number | null;
      quantity_unit: string | null;
      view_count: number;
      created_at: Date;
      is_active: boolean;
    }>;
  }> => {
    return apiClient.get('/stores/me/promotions');
  },

  /**
   * 프로모션 상세 조회
   * GET /api/stores/me/promotions/:promotion_id
   */
  getPromotion: async (promotion_id: string): Promise<{
    success: boolean;
    data: {
      promotion_id: string;
      ingredient_id: number;
      ingredient_name: string | null;
      title: string;
      description: string | null;
      sale_price: number;
      original_price: number | null;
      start_date: Date;
      end_date: Date;
      promotion_image_url: string | null;
      quantity: number | null;
      quantity_unit: string | null;
      view_count: number;
      created_at: Date;
    };
  }> => {
    return apiClient.get(`/stores/me/promotions/${promotion_id}`);
  },

  /**
   * 프로모션 수정
   * PUT /api/stores/me/promotions/:promotion_id
   */
  updatePromotion: async (
    promotion_id: string,
    params: {
      ingredient_id?: number;
      title?: string;
      description?: string;
      sale_price?: number;
      original_price?: number;
      start_date?: string;
      end_date?: string;
      promotion_image_url?: string;
      quantity?: number;
      quantity_unit?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      promotion_id: string;
      ingredient_id: number;
      title: string;
      description: string | null;
      sale_price: number;
      original_price: number | null;
      start_date: Date;
      end_date: Date;
      promotion_image_url: string | null;
      quantity: number | null;
      quantity_unit: string | null;
    };
  }> => {
    return apiClient.put(`/stores/me/promotions/${promotion_id}`, params);
  },

  /**
   * 프로모션 삭제
   * DELETE /api/stores/me/promotions/:promotion_id
   */
  deletePromotion: async (promotion_id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    return apiClient.delete(`/stores/me/promotions/${promotion_id}`);
  },

  /**
   * 위치 기반 기획 상품 조회 (SearchScreen용)
   * GET /api/stores/promotions/nearby
   */
  getNearbyPromotions: async (params: {
    location_text: string;
  }): Promise<{
    success: boolean;
    data: Array<{
      promotion_id: string;
      store_id: string;
      store_name: string | null;
      store_address: string | null;
      ingredient_id: number;
      ingredient_name: string | null;
      title: string;
      description: string | null;
      sale_price: number;
      original_price: number | null;
      start_date: Date;
      end_date: Date;
      promotion_image_url: string | null;
      quantity: number | null;
      quantity_unit: string | null;
      view_count: number;
      created_at: Date;
    }>;
  }> => {
    return apiClient.get('/stores/promotions/nearby', { params });
  },

  /**
   * 기획 상품 view_count 증가
   * POST /api/stores/promotions/:promotion_id/view
   */
  incrementPromotionViewCount: async (promotion_id: string): Promise<{
    success: boolean;
    data: {
      promotion_id: string;
      view_count: number;
    };
  }> => {
    return apiClient.post(`/stores/promotions/${promotion_id}/view`);
  },
};

/**
 * 광고주 관련 API
 */
export const AdvertiserAPI = {
  /**
   * 광고주 등록
   * POST /api/advertisers
   * @param params 광고주 등록 파라미터
   */
  createAdvertiser: async (params: {
    user_id: string;
    biz_name: string;
    biz_owner?: string;
    biz_reg_no: string;
    biz_address?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      advertiser_id: string;
      biz_name: string;
    };
  }> => {
    return apiClient.post('/advertisers', params);
  },

  /**
   * 내 광고주 정보 조회
   * GET /api/advertisers/me
   */
  getMyAdvertiser: async (): Promise<{
    success: boolean;
    data: {
      advertiser_id: string;
      biz_name: string;
      biz_owner?: string;
      biz_reg_no: string;
      biz_address?: string;
      charged: number;
      created_at: Date;
    };
  }> => {
    return apiClient.get('/advertisers/me');
  },

  /**
   * 내 광고 소재 목록 조회
   * GET /api/advertisers/me/creatives
   */
  getMyCreatives: async (): Promise<{
    success: boolean;
    data: Array<{
      creative_id: string;
      ad_title?: string;
      ad_body?: string;
      ad_image_url: string;
      ad_type?: number;
      landing_page_url: string;
      creater_name?: string;
      creater_image_url?: string;
      created_at: Date;
    }>;
  }> => {
    return apiClient.get('/advertisers/me/creatives');
  },

  /**
   * 광고 소재 등록
   * POST /api/advertisers/me/creatives
   */
  createCreative: async (params: {
    ad_title?: string;
    ad_body?: string;
    ad_image_url: string;
    ad_type: number; // 1: 피드광고, 2: 레시피카드 광고
    landing_page_url: string;
    creater_name?: string;
    creater_image_url?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      creative_id: string;
      ad_title?: string;
      ad_type?: number;
    };
  }> => {
    return apiClient.post('/advertisers/me/creatives', params);
  },

  /**
   * 광고 소재 상세 조회
   * GET /api/advertisers/me/creatives/:creative_id
   */
  getCreative: async (creative_id: string): Promise<{
    success: boolean;
    data: {
      creative_id: string;
      ad_title?: string;
      ad_body?: string;
      ad_image_url: string;
      ad_type?: number;
      landing_page_url: string;
      creater_name?: string;
      creater_image_url?: string;
      created_at: Date;
      updated_at: Date;
    };
  }> => {
    return apiClient.get(`/advertisers/me/creatives/${creative_id}`);
  },

  /**
   * 광고 소재 수정
   * PUT /api/advertisers/me/creatives/:creative_id
   */
  updateCreative: async (
    creative_id: string,
    params: {
      ad_title?: string;
      ad_body?: string;
      ad_image_url?: string;
      ad_type?: number;
      landing_page_url?: string;
      creater_name?: string;
      creater_image_url?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      creative_id: string;
      ad_title?: string;
      ad_type?: number;
    };
  }> => {
    return apiClient.put(`/advertisers/me/creatives/${creative_id}`, params);
  },

  /**
   * 광고 소재 삭제
   * DELETE /api/advertisers/me/creatives/:creative_id
   */
  deleteCreative: async (creative_id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    return apiClient.delete(`/advertisers/me/creatives/${creative_id}`);
  },

  /**
   * 내 캠페인 목록 조회
   * GET /api/advertisers/me/campaigns
   */
  getMyCampaigns: async (): Promise<{
    success: boolean;
    data: Array<{
      campaign_id: string;
      campaign_name: string;
      total_budget: number;
      cpi: number;
      start_date: Date;
      end_date: Date;
      status: string;
      view_count: number;
      click_count: number;
      spent: number;
      daysLeft: number;
      progress: number;
      created_at: Date;
    }>;
  }> => {
    return apiClient.get('/advertisers/me/campaigns');
  },

  /**
   * 캠페인 생성
   * POST /api/advertisers/me/campaigns
   */
  createCampaign: async (params: {
    campaign_name: string;
    total_budget: number;
    cpi: number;
    start_date: string; // YYYY-MM-DD 형식
    end_date: string; // YYYY-MM-DD 형식
    creative_ids: string[];
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      campaign_id: string;
      campaign_name: string;
    };
  }> => {
    return apiClient.post('/advertisers/me/campaigns', params);
  },

  /**
   * 캠페인 상세 조회
   * GET /api/advertisers/me/campaigns/:campaign_id
   */
  getCampaign: async (campaign_id: string): Promise<{
    success: boolean;
    data: {
      campaign_id: string;
      campaign_name: string;
      total_budget: number;
      cpi: number;
      start_date: Date;
      end_date: Date;
      status: string;
      view_count: number;
      click_count: number;
      spent: number;
      daysLeft: number;
      progress: number;
      avgCPI: number;
      creatives: Array<{
        creative_id: string;
        ad_title?: string;
        ad_body?: string;
        ad_image_url: string;
        ad_type?: number;
        landing_page_url: string;
        creater_name?: string;
        creater_image_url?: string;
      }>;
      created_at: Date;
      updated_at: Date;
    };
  }> => {
    return apiClient.get(`/advertisers/me/campaigns/${campaign_id}`);
  },

  /**
   * 캠페인 수정
   * PUT /api/advertisers/me/campaigns/:campaign_id
   */
  updateCampaign: async (
    campaign_id: string,
    params: {
      campaign_name?: string;
      total_budget?: number;
      cpi?: number;
      start_date?: string;
      end_date?: string;
      creative_ids?: string[];
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      campaign_id: string;
      campaign_name: string;
    };
  }> => {
    return apiClient.put(`/advertisers/me/campaigns/${campaign_id}`, params);
  },

  /**
   * 캠페인 삭제
   * DELETE /api/advertisers/me/campaigns/:campaign_id
   */
  deleteCampaign: async (campaign_id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    return apiClient.delete(`/advertisers/me/campaigns/${campaign_id}`);
  },

  /**
   * 캠페인 상태 변경
   * PUT /api/advertisers/me/campaigns/:campaign_id/status
   */
  updateCampaignStatus: async (
    campaign_id: string,
    status: 'ACTIVE' | 'PAUSED',
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      campaign_id: string;
      status: string;
    };
  }> => {
    return apiClient.put(`/advertisers/me/campaigns/${campaign_id}/status`, {
      status,
    });
  },

  /**
   * 광고주 대시보드 통계 조회
   * GET /api/advertisers/me/stats?days=7
   */
  getAdvertiserStats: async (days: number = 7): Promise<{
    success: boolean;
    data: {
      totalImpressions: number;
      totalClicks: number;
      ctr: number;
      dailyStats: Array<{
        date: string;
        impressions: number;
        clicks: number;
      }>;
    };
  }> => {
    return apiClient.get('/advertisers/me/stats', {
      params: { days },
    });
  },

  /**
   * 캠페인 상세 통계 조회
   * GET /api/advertisers/me/campaigns/:campaign_id/stats?days=7
   */
  getCampaignStats: async (campaign_id: string, days: number = 7): Promise<{
    success: boolean;
    data: {
      campaign_id: string;
      campaign_name: string;
      totalImpressions: number;
      totalClicks: number;
      ctr: number;
      dailyStats: Array<{
        date: string;
        impressions: number;
        clicks: number;
      }>;
    };
  }> => {
    return apiClient.get(`/advertisers/me/campaigns/${campaign_id}/stats`, {
      params: { days },
    });
  },
};

/**
 * 채팅 API
 */
export const ChatAPI = {
  /**
   * 채팅방 목록 조회
   */
  getRooms: async () => {
    return apiClient.get('/chat/rooms');
  },

  /**
   * 채팅방 생성 또는 조회
   */
  createOrGetRoom: async (otherUserId: string) => {
    return apiClient.post('/chat/rooms', {
      other_user_id: otherUserId,
    });
  },

  /**
   * 채팅방 메시지 조회
   */
  getMessages: async (roomId: string, limit?: number, before?: string) => {
    const params: any = {};
    if (limit) params.limit = limit;
    if (before) params.before = before;
    return apiClient.get(`/chat/rooms/${roomId}/messages`, { params });
  },

  /**
   * 메시지 전송
   */
  sendMessage: async (roomId: string, content: string, contentType: number = 0) => {
    return apiClient.post(`/chat/rooms/${roomId}/messages`, {
      content,
      content_type: contentType,
    });
  },

  /**
   * 채팅방 나가기
   */
  leaveRoom: async (roomId: string) => {
    return apiClient.delete(`/chat/rooms/${roomId}/leave`);
  },
};

/**
 * 알림 API
 */
export const NotificationAPI = {
  /**
   * 알림 목록 조회
   */
  getNotifications: async () => {
    return apiClient.get('/notifications');
  },

  /**
   * 읽지 않은 알림 개수 조회
   */
  getUnreadCount: async () => {
    return apiClient.get('/notifications/unread-count');
  },

  /**
   * 알림 읽음 처리
   */
  markAsRead: async (notificationId: string) => {
    return apiClient.put(`/notifications/${notificationId}/read`);
  },

  /**
   * 모든 알림 읽음 처리
   */
  markAllAsRead: async () => {
    return apiClient.put('/notifications/read-all');
  },
};

/**
 * 공지사항 API
 */
export const AnnouncementAPI = {
  /**
   * 공지사항 목록 조회
   */
  getAnnouncements: async () => {
    return apiClient.get('/announcements');
  },

  /**
   * 공지사항 상세 조회
   */
  getAnnouncementDetail: async (announceCode: number) => {
    return apiClient.get(`/announcements/${announceCode}`);
  },
};

/**
 * 약관 API
 */
export const TermsAPI = {
  /**
   * 약관 목록 조회
   */
  getTerms: async () => {
    return apiClient.get('/terms');
  },

  /**
   * 약관 상세 조회
   */
  getTermDetail: async (termId: number) => {
    return apiClient.get(`/terms/${termId}`);
  },
};

/**
 * 앱 정보 API
 */
export const AppAPI = {
  /**
   * 고객센터 정보 조회
   */
  getCustomerServiceInfo: async () => {
    return apiClient.get('/app/customer-service');
  },

  /**
   * QnA 목록 조회
   */
  getQnA: async () => {
    return apiClient.get('/app/qna');
  },
};

/**
 * 사업자 등록번호 조회 API
 */
export const BusinessAPI = {
  /**
   * 사업자 등록번호 조회
   * @param businessNumber 사업자 등록번호 (10자리 숫자, 하이픈 제거)
   */
  inquireBusiness: async (businessNumber: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      trade_name: string; // 상호명
      representative: string; // 대표자명
    };
  }> => {
    return apiClient.post('/business/inquire', { business_number: businessNumber });
  },
};

/**
 * 카카오 주소 검색 API
 * 카카오 로컬 API를 사용하여 주소를 검색합니다.
 * API 키는 KAKAO_REST_API_KEY 환경 변수 또는 설정에서 가져옵니다.
 */
export const AdAPI = {
  /**
   * 피드 광고 조회
   * GET /api/ads/feed
   */
  getFeedAd: async (): Promise<{
    success: boolean;
    data: {
      creative_id: string;
      ad_title?: string;
      ad_body?: string;
      ad_image_url: string;
      landing_page_url: string;
      creater_name?: string;
      creater_image_url?: string;
    } | null;
  }> => {
    return apiClient.get('/ads/feed');
  },

  /**
   * 레시피 카드 광고 조회
   * GET /api/ads/recipe-card?recipe_post_id=xxx
   */
  getRecipeCardAd: async (recipe_post_id?: string): Promise<{
    success: boolean;
    data: {
      creative_id: string;
      ad_title?: string;
      ad_body?: string;
      ad_image_url: string;
      landing_page_url: string;
      creater_name?: string;
      creater_image_url?: string;
    } | null;
  }> => {
    return apiClient.get('/ads/recipe-card', {
      params: recipe_post_id ? { recipe_post_id } : {},
    });
  },

  /**
   * 광고 노출 기록
   * POST /api/ads/impressions
   */
  recordImpression: async (
    creativeId: string,
    recipePostId?: string,
  ): Promise<{
    success: boolean;
    message?: string;
    data?: { impression_id: string | null };
  }> => {
    return apiClient.post('/ads/impressions', {
      creative_id: creativeId,
      recipe_post_id: recipePostId || null,
    });
  },

  /**
   * 광고 클릭 기록
   * POST /api/ads/clicks
   */
  recordClick: async (creativeId: string, impressionId?: string): Promise<{
    success: boolean;
    message?: string;
    data?: { click_id: string };
  }> => {
    return apiClient.post('/ads/clicks', {
      creative_id: creativeId,
      impression_id: impressionId,
    });
  },
};

export const AddressSearchAPI = {
  /**
   * 주소 검색 (백엔드 API를 통해 검색)
   * @param query 검색 키워드 (예: "서울시 강남구 역삼동")
   * @param page 페이지 번호 (기본값: 1)
   * @param size 페이지 크기 (기본값: 15)
   */
  searchAddress: async (query: string, page: number = 1, size: number = 15) => {
    try {
      const response = await apiClient.get('/app/address/search', {
        params: {
          query,
          page,
          size,
        },
      });

      return response;
    } catch (error: any) {
      console.error('❌ [AddressSearchAPI] 주소 검색 오류:', error);

      let errorMessage = '주소 검색에 실패했습니다.';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
        data: null,
      };
    }
  },
};

/**
 * 신고 및 숨김 처리 API
 */
export const ReportAPI = {
  /**
   * 사용자 신고
   * @param reportedUserId 신고할 사용자 ID
   * @param reportReason 신고 사유
   * @param reportDetail 신고 상세 내용 (선택)
   * @param reportType 신고 타입: 'USER' | 'POST' | 'CHAT' (기본값: 'USER')
   * @param recipePostId 게시글 신고인 경우 게시글 ID (선택)
   * @param chatMessageId 채팅 신고인 경우 채팅 메시지 ID (선택)
   * @param chatRoomId 채팅 신고인 경우 채팅방 ID (선택)
   */
  reportUser: async (
    reportedUserId: string,
    reportReason: string,
    reportDetail?: string,
    reportType: 'USER' | 'POST' | 'CHAT' = 'USER',
    recipePostId?: string,
    chatMessageId?: string,
    chatRoomId?: string,
  ) => {
    const payload: any = {
      reported_user_id: reportedUserId,
      report_reason: reportReason,
      report_type: reportType,
    };

    if (reportDetail) {
      payload.report_detail = reportDetail;
    }

    if (reportType === 'POST' && recipePostId) {
      payload.recipe_post_id = recipePostId;
    }

    if (reportType === 'CHAT') {
      if (chatMessageId) {
        payload.chat_message_id = chatMessageId;
      }
      if (chatRoomId) {
        payload.chat_room_id = chatRoomId;
      }
    }

    return apiClient.post('/reports/users', payload);
  },

  /**
   * 사용자 숨김 처리
   * @param userId 숨김 처리할 사용자 ID
   */
  hideUser: async (userId: string) => {
    return apiClient.post(`/reports/users/${userId}/hide`);
  },

  /**
   * 사용자 숨김 해제
   * @param userId 숨김 해제할 사용자 ID
   */
  unhideUser: async (userId: string) => {
    return apiClient.delete(`/reports/users/${userId}/hide`);
  },

  /**
   * 숨김 처리한 사용자 목록 조회
   */
  getHiddenUsers: async () => {
    return apiClient.get('/reports/users/hidden');
  },
};

export default apiClient;
