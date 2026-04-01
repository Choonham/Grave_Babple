import {takeLatest} from 'redux-saga/effects';
import {createRequestSaga} from './createRequestSaga';
import {PostAPI, RecipeAPI} from '../../api/ApiRequests';
import {
  RECIPE_LIST_LOAD,
  RECIPE_DETAIL_LOAD,
  POST_LIST_LOAD,
  POST_DETAIL_LOAD,
  POST_CREATE,
  POST_UPDATE,
  POST_DELETE,
  POST_LIKE,
  POST_UNLIKE,
  POST_SEARCH,
} from '../states/postState';

/**
 * 레시피 관련 사가들
 */

// 레시피 목록 로드 사가
const recipeListLoadSaga = createRequestSaga(
  RECIPE_LIST_LOAD,
  RecipeAPI.getRecommendations,
);

// 레시피 상세 로드 사가
const recipeDetailLoadSaga = createRequestSaga(
  RECIPE_DETAIL_LOAD,
  RecipeAPI.getRecipeDetail,
);

/**
 * 게시물 관련 사가들
 */

// 게시물 목록 로드 사가
const postListLoadSaga = createRequestSaga(POST_LIST_LOAD, PostAPI.getPosts);

// 게시물 상세 로드 사가
const postDetailLoadSaga = createRequestSaga(
  POST_DETAIL_LOAD,
  PostAPI.getPostDetail,
);

// 게시물 생성 사가
const postCreateSaga = createRequestSaga(POST_CREATE, PostAPI.createPost);

// 게시물 수정 사가
const postUpdateSaga = createRequestSaga(POST_UPDATE, PostAPI.updatePost);

// 게시물 삭제 사가
const postDeleteSaga = createRequestSaga(POST_DELETE, PostAPI.deletePost);

// 게시물 좋아요 사가
const postLikeSaga = createRequestSaga(POST_LIKE, PostAPI.likePost);

// 게시물 좋아요 취소 사가
const postUnlikeSaga = createRequestSaga(POST_UNLIKE, PostAPI.unlikePost);

// 게시물 검색 사가
const postSearchSaga = createRequestSaga(POST_SEARCH, PostAPI.searchPosts);

/**
 * 게시물 상태 사가 루트 함수
 * 모든 게시물 관련 액션을 감시하고 처리합니다.
 */
export function* postSaga() {
  // 레시피 관련 사가들
  yield takeLatest(RECIPE_LIST_LOAD, recipeListLoadSaga);
  yield takeLatest(RECIPE_DETAIL_LOAD, recipeDetailLoadSaga);

  // 게시물 관련 사가들
  yield takeLatest(POST_LIST_LOAD, postListLoadSaga);
  yield takeLatest(POST_DETAIL_LOAD, postDetailLoadSaga);
  yield takeLatest(POST_CREATE, postCreateSaga);
  yield takeLatest(POST_UPDATE, postUpdateSaga);
  yield takeLatest(POST_DELETE, postDeleteSaga);
  yield takeLatest(POST_LIKE, postLikeSaga);
  yield takeLatest(POST_UNLIKE, postUnlikeSaga);
  yield takeLatest(POST_SEARCH, postSearchSaga);
}
