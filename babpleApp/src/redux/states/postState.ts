import {
  createRequestActionTypes,
  createRequestAction,
  Callbacks,
} from '../utils/createRequestActionTypes';

/**
 * 레시피 게시물 인터페이스
 */
export interface RecipePost {
  recipe_post_id: string;
  user_id: string;
  title: string;
  description?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  type?: number;
  delete_yn: boolean;
  deleted_at?: string;
  // 연관 데이터
  user?: {
    nickname: string;
    profile_image_url?: string;
  };
  images?: Array<{
    image_id: string;
    image_url: string;
    sequence: number;
  }>;
  ingredients?: Array<{
    ingredient_id: number;
    name: string;
    quantity: number;
    unit: string;
  }>;
  steps?: Array<{
    step_id: string;
    step_number: number;
    instruction: string;
    image_url?: string;
  }>;
  categories?: Array<{
    type: number;
    category_id: number;
    name: string;
  }>;
}

/**
 * 게시물 상태 인터페이스
 */
export interface PostState {
  list: RecipePost[]; // 메인 게시물 목록
  offlineList: RecipePost[]; // 오프라인 캐시된 게시물 목록
  detail: RecipePost | null; // 현재 선택된 게시물 상세
  searchCondition: {
    // 검색 조건
    location?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
    categories?: Array<{
      type: number;
      category_id: number;
    }>;
    keyword?: string;
  };
  isLoading: boolean; // 로딩 상태
  error: string | null; // 에러 메시지
}

/**
 * 액션 타입 정의
 */
const [RECIPE_LIST_LOAD, RECIPE_LIST_LOAD_SUCCESS, RECIPE_LIST_LOAD_FAILURE] =
  createRequestActionTypes('postState/RECIPE_LIST_LOAD');

const [
  RECIPE_DETAIL_LOAD,
  RECIPE_DETAIL_LOAD_SUCCESS,
  RECIPE_DETAIL_LOAD_FAILURE,
] = createRequestActionTypes('postState/RECIPE_DETAIL_LOAD');

const [POST_LIST_LOAD, POST_LIST_LOAD_SUCCESS, POST_LIST_LOAD_FAILURE] =
  createRequestActionTypes('postState/POST_LIST_LOAD');

const [POST_DETAIL_LOAD, POST_DETAIL_LOAD_SUCCESS, POST_DETAIL_LOAD_FAILURE] =
  createRequestActionTypes('postState/POST_DETAIL_LOAD');

const [POST_CREATE, POST_CREATE_SUCCESS, POST_CREATE_FAILURE] =
  createRequestActionTypes('postState/POST_CREATE');

const [POST_UPDATE, POST_UPDATE_SUCCESS, POST_UPDATE_FAILURE] =
  createRequestActionTypes('postState/POST_UPDATE');

const [POST_DELETE, POST_DELETE_SUCCESS, POST_DELETE_FAILURE] =
  createRequestActionTypes('postState/POST_DELETE');

const [POST_LIKE, POST_LIKE_SUCCESS, POST_LIKE_FAILURE] =
  createRequestActionTypes('postState/POST_LIKE');

const [POST_UNLIKE, POST_UNLIKE_SUCCESS, POST_UNLIKE_FAILURE] =
  createRequestActionTypes('postState/POST_UNLIKE');

const [POST_SEARCH, POST_SEARCH_SUCCESS, POST_SEARCH_FAILURE] =
  createRequestActionTypes('postState/POST_SEARCH');

/**
 * 레시피 목록 로드 액션 생성자
 * @param params 로드 파라미터
 * @param callbacks 성공/실패 콜백
 */
export const recipeListLoad = (params: any, callbacks: Callbacks) => {
  return createRequestAction(RECIPE_LIST_LOAD, params, callbacks);
};

/**
 * 레시피 상세 로드 액션 생성자
 * @param recipePostId 레시피 ID
 * @param callbacks 성공/실패 콜백
 */
export const recipeDetailLoad = (
  recipePostId: string,
  callbacks: Callbacks,
) => {
  return createRequestAction(RECIPE_DETAIL_LOAD, {recipePostId}, callbacks);
};

/**
 * 액션 생성자들
 */

/**
 * 게시물 목록 로드 액션 생성자
 * @param params 로드 파라미터 (페이지, 위치, 카테고리 등)
 * @param callbacks 성공/실패 콜백
 */
export const postListLoad = (params: any, callbacks: Callbacks) => {
  return createRequestAction(POST_LIST_LOAD, params, callbacks);
};

/**
 * 게시물 상세 로드 액션 생성자
 * @param postId 게시물 ID
 * @param callbacks 성공/실패 콜백
 */
export const postDetailLoad = (postId: string, callbacks: Callbacks) => {
  return createRequestAction(POST_DETAIL_LOAD, {postId}, callbacks);
};

/**
 * 게시물 생성 액션 생성자
 * @param postData 게시물 데이터
 * @param callbacks 성공/실패 콜백
 */
export const postCreate = (postData: any, callbacks: Callbacks) => {
  return createRequestAction(POST_CREATE, postData, callbacks);
};

/**
 * 게시물 수정 액션 생성자
 * @param postId 게시물 ID
 * @param postData 수정할 게시물 데이터
 * @param callbacks 성공/실패 콜백
 */
export const postUpdate = (
  postId: string,
  postData: any,
  callbacks: Callbacks,
) => {
  return createRequestAction(POST_UPDATE, {postId, ...postData}, callbacks);
};

/**
 * 게시물 삭제 액션 생성자
 * @param postId 게시물 ID
 * @param callbacks 성공/실패 콜백
 */
export const postDelete = (postId: string, callbacks: Callbacks) => {
  return createRequestAction(POST_DELETE, {postId}, callbacks);
};

/**
 * 게시물 좋아요 액션 생성자
 * @param postId 게시물 ID
 * @param callbacks 성공/실패 콜백
 */
export const postLike = (postId: string, callbacks: Callbacks) => {
  return createRequestAction(POST_LIKE, {postId}, callbacks);
};

/**
 * 게시물 좋아요 취소 액션 생성자
 * @param postId 게시물 ID
 * @param callbacks 성공/실패 콜백
 */
export const postUnlike = (postId: string, callbacks: Callbacks) => {
  return createRequestAction(POST_UNLIKE, {postId}, callbacks);
};

/**
 * 게시물 검색 액션 생성자
 * @param searchCondition 검색 조건
 * @param callbacks 성공/실패 콜백
 */
export const postSearch = (searchCondition: any, callbacks: Callbacks) => {
  return createRequestAction(POST_SEARCH, searchCondition, callbacks);
};

/**
 * 게시물 상태 초기값
 */
const initialState: PostState = {
  list: [],
  offlineList: [],
  detail: null,
  searchCondition: {},
  isLoading: false,
  error: null,
};

/**
 * 게시물 상태 리듀서
 * 게시물 목록, 상세, 검색 상태를 관리합니다.
 *
 * @param state 현재 상태
 * @param action 디스패치된 액션
 * @returns 새로운 상태
 */
export default function postState(
  state: PostState = initialState,
  action: any,
): PostState {
  switch (action.type) {
    // 레시피 목록 로드 요청
    case RECIPE_LIST_LOAD:
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    // 레시피 목록 로드 성공
    case RECIPE_LIST_LOAD_SUCCESS:
      return {
        ...state,
        list: action.payload.data || action.payload,
        isLoading: false,
        error: null,
      };

    // 레시피 목록 로드 실패
    case RECIPE_LIST_LOAD_FAILURE:
      console.log('RECIPE_LIST_LOAD_FAILURE!!');
      console.log(action.payload);
      return {
        ...state,
        isLoading: false,
        error: action.payload?.message || '레시피를 불러오는데 실패했습니다.',
      };

    // 레시피 상세 로드 성공
    case RECIPE_DETAIL_LOAD_SUCCESS:
      return {
        ...state,
        detail: action.payload.data || action.payload,
        error: null,
      };

    // 레시피 상세 로드 실패
    case RECIPE_DETAIL_LOAD_FAILURE:
      console.log('RECIPE_DETAIL_LOAD_FAILURE!!');
      console.log(action.payload);
      return {
        ...state,
        detail: null,
        error:
          action.payload?.message || '레시피 상세를 불러오는데 실패했습니다.',
      };

    // 게시물 목록 로드 요청
    case POST_LIST_LOAD:
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    // 게시물 목록 로드 성공
    case POST_LIST_LOAD_SUCCESS:
      return {
        ...state,
        list: action.payload,
        isLoading: false,
        error: null,
      };

    // 게시물 목록 로드 실패
    case POST_LIST_LOAD_FAILURE:
      console.log('POST_LIST_LOAD_FAILURE!!');
      console.log(action.payload);
      return {
        ...state,
        isLoading: false,
        error: action.payload?.message || '게시물을 불러오는데 실패했습니다.',
      };

    // 게시물 상세 로드 성공
    case POST_DETAIL_LOAD_SUCCESS:
      return {
        ...state,
        detail: action.payload,
        error: null,
      };

    // 게시물 상세 로드 실패
    case POST_DETAIL_LOAD_FAILURE:
      console.log('POST_DETAIL_LOAD_FAILURE!!');
      console.log(action.payload);
      return {
        ...state,
        detail: null,
        error:
          action.payload?.message || '게시물 상세를 불러오는데 실패했습니다.',
      };

    // 게시물 생성 성공
    case POST_CREATE_SUCCESS:
      return {
        ...state,
        list: [action.payload, ...state.list],
        error: null,
      };

    // 게시물 생성 실패
    case POST_CREATE_FAILURE:
      console.log('POST_CREATE_FAILURE!!');
      console.log(action.payload);
      return {
        ...state,
        error: action.payload?.message || '게시물 생성에 실패했습니다.',
      };

    // 게시물 수정 성공
    case POST_UPDATE_SUCCESS:
      return {
        ...state,
        list: state.list.map(post =>
          post.recipe_post_id === action.payload.recipe_post_id
            ? action.payload
            : post,
        ),
        detail:
          state.detail?.recipe_post_id === action.payload.recipe_post_id
            ? action.payload
            : state.detail,
        error: null,
      };

    // 게시물 삭제 성공
    case POST_DELETE_SUCCESS:
      return {
        ...state,
        list: state.list.filter(post => post.recipe_post_id !== action.payload),
        detail:
          state.detail?.recipe_post_id === action.payload ? null : state.detail,
        error: null,
      };

    // 게시물 좋아요 성공
    case POST_LIKE_SUCCESS:
      return {
        ...state,
        list: state.list.map(post =>
          post.recipe_post_id === action.payload.postId
            ? {...post, like_count: post.like_count + 1}
            : post,
        ),
        detail:
          state.detail?.recipe_post_id === action.payload.postId
            ? {...state.detail, like_count: state.detail.like_count + 1}
            : state.detail,
        error: null,
      };

    // 게시물 좋아요 취소 성공
    case POST_UNLIKE_SUCCESS:
      return {
        ...state,
        list: state.list.map(post =>
          post.recipe_post_id === action.payload.postId
            ? {...post, like_count: Math.max(0, post.like_count - 1)}
            : post,
        ),
        detail:
          state.detail?.recipe_post_id === action.payload.postId
            ? {
                ...state.detail,
                like_count: Math.max(0, state.detail.like_count - 1),
              }
            : state.detail,
        error: null,
      };

    // 게시물 검색 성공
    case POST_SEARCH_SUCCESS:
      return {
        ...state,
        list: action.payload,
        searchCondition: action.meta?.searchCondition || state.searchCondition,
        error: null,
      };

    default:
      return state;
  }
}

// 액션 타입들을 외부에서 사용할 수 있도록 export
export {
  RECIPE_LIST_LOAD,
  RECIPE_LIST_LOAD_SUCCESS,
  RECIPE_LIST_LOAD_FAILURE,
  RECIPE_DETAIL_LOAD,
  RECIPE_DETAIL_LOAD_SUCCESS,
  RECIPE_DETAIL_LOAD_FAILURE,
  POST_LIST_LOAD,
  POST_LIST_LOAD_SUCCESS,
  POST_LIST_LOAD_FAILURE,
  POST_DETAIL_LOAD,
  POST_DETAIL_LOAD_SUCCESS,
  POST_DETAIL_LOAD_FAILURE,
  POST_CREATE,
  POST_CREATE_SUCCESS,
  POST_CREATE_FAILURE,
  POST_UPDATE,
  POST_UPDATE_SUCCESS,
  POST_UPDATE_FAILURE,
  POST_DELETE,
  POST_DELETE_SUCCESS,
  POST_DELETE_FAILURE,
  POST_LIKE,
  POST_LIKE_SUCCESS,
  POST_LIKE_FAILURE,
  POST_UNLIKE,
  POST_UNLIKE_SUCCESS,
  POST_UNLIKE_FAILURE,
  POST_SEARCH,
  POST_SEARCH_SUCCESS,
  POST_SEARCH_FAILURE,
};
