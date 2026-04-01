import {Router} from 'express';
import {RecipeController} from '../controllers/RecipeController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 레시피 관련 라우트
 */

// 레시피 카테고리 조회 (공개 데이터이므로 인증 불필요)
router.get('/categories', RecipeController.getCategories);

// 추천 레시피 리스트 조회 (공개 데이터이므로 인증 불필요)
router.get('/recommendations', RecipeController.getRecommendations);
router.get('/feed', RecipeController.getFeed);
router.get('/search', RecipeController.searchRecipes);
router.get('/local-ranking', RecipeController.getLocalRanking);
router.get('/recent-random', RecipeController.getRecentRandomRecipes);

// 특정 재료를 주재료로 사용한 레시피 중 가장 좋아요가 많은 레시피 조회
router.get('/by-main-ingredient/:ingredient_id/top', RecipeController.getTopRecipeByMainIngredient);

// 레시피 등록
router.post('/', authenticateToken, RecipeController.createRecipe);

// AI 쉐프 이미지 분석
router.post('/ai-analyze', authenticateToken, RecipeController.analyzeImageWithAI);

// 레시피 기본 재료 조회
router.get('/:recipe_post_id/default-ingredients', RecipeController.getDefaultIngredients);

// 레시피 기본 스텝 조회
router.get('/:recipe_post_id/default-steps', RecipeController.getDefaultSteps);

// 공개 공유용 레시피 상세 조회 (인증 불필요)
router.get('/:recipe_post_id/share', RecipeController.getRecipeForShare);

// 레시피 상세 조회
router.get('/:recipe_post_id', RecipeController.getRecipeDetail);

// 레시피 수정
router.put('/:recipe_post_id', authenticateToken, RecipeController.updateRecipe);

// 레시피 삭제
router.delete('/:recipe_post_id', authenticateToken, RecipeController.deleteRecipe);

// 레시피 좋아요 / 좋아요 취소
router.post('/:recipe_post_id/like', authenticateToken, RecipeController.likeRecipe);
router.delete('/:recipe_post_id/like', authenticateToken, RecipeController.unlikeRecipe);

// 레시피 댓글 작성
router.post('/:recipe_post_id/comments', authenticateToken, RecipeController.createComment);

export default router;
