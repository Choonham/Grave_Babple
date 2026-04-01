import {Router} from 'express';
import {IngredientController} from '../controllers/IngredientController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 재료 관련 라우트
 */

// 재료 검색 (인증 선택적 - 컨트롤러에서 직접 처리)
router.get('/search', IngredientController.searchIngredients);

// 재료 추가 (인증 필수)
router.post('/', authenticateToken, IngredientController.createIngredient);

export default router;

