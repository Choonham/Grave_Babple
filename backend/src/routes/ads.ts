import {Router} from 'express';
import {AdController} from '../controllers/AdController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 광고 관련 라우트
 */

// 피드 광고 조회 (인증 선택적 - 로그인하지 않은 사용자도 볼 수 있음)
router.get('/feed', AdController.getFeedAd);

// 레시피 카드 광고 조회 (인증 선택적 - 로그인하지 않은 사용자도 볼 수 있음)
router.get('/recipe-card', AdController.getRecipeCardAd);

// 광고 노출 기록 (인증 필요)
router.post('/impressions', authenticateToken, AdController.recordImpression);

// 광고 클릭 기록 (인증 필요)
router.post('/clicks', authenticateToken, AdController.recordClick);

export default router;

