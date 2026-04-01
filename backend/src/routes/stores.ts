import {Router} from 'express';
import {StoreController} from '../controllers/StoreController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 상점 관련 라우트
 */

// 상점 등록 (회원가입 중인 사용자도 등록 가능 - body에 user_id 포함)
router.post('/', StoreController.createStore);

// 내 상점 조회 (/:store_id보다 먼저 정의해야 함)
router.get('/me', authenticateToken, StoreController.getMyStore);

// 내 상점 정보 수정
router.put('/me', authenticateToken, StoreController.updateStore);

// 상점 대시보드 통계 조회
router.get('/me/dashboard', authenticateToken, StoreController.getStoreDashboardStats);

// 내 상점의 진행 중인 프로모션 목록 조회
router.get('/me/promotions/active', authenticateToken, StoreController.getMyStoreActivePromotions);

// 전단지 관련 라우트 (/:store_id/flyers보다 먼저 정의)
router.post('/me/flyers', authenticateToken, StoreController.createFlyer);
router.get('/me/flyers', authenticateToken, StoreController.getMyFlyers);
router.get('/me/flyers/:flyer_id', authenticateToken, StoreController.getFlyer);
router.put('/me/flyers/:flyer_id', authenticateToken, StoreController.updateFlyer);
router.delete('/me/flyers/:flyer_id', authenticateToken, StoreController.deleteFlyer);

// 프로모션 관련 라우트 (/:store_id/promotions보다 먼저 정의)
router.post('/me/promotions', authenticateToken, StoreController.createPromotion);
router.get('/me/promotions', authenticateToken, StoreController.getMyPromotions);
router.get('/me/promotions/:promotion_id', authenticateToken, StoreController.getPromotion);
router.put('/me/promotions/:promotion_id', authenticateToken, StoreController.updatePromotion);
router.delete('/me/promotions/:promotion_id', authenticateToken, StoreController.deletePromotion);

// 재료 목록 조회 (프로모션 등록용) - /:store_id보다 먼저 정의해야 함
router.get('/ingredients', StoreController.getIngredients);

// 위치 기반 기획 상품 조회 (SearchScreen용, 인증 불필요) - /:store_id보다 먼저 정의해야 함
router.get('/promotions/nearby', StoreController.getNearbyPromotions);

// 가게 상세 조회 (인증 불필요) - /me, /ingredients, /promotions/nearby보다 나중에 정의
router.get('/:store_id', StoreController.getStoreDetail);

// 가게 방문 수 증가 (인증 불필요)
router.post('/:store_id/visit', StoreController.incrementStoreVisitCount);

// 가게 전단지 목록 조회 (인증 불필요)
router.get('/:store_id/flyers', StoreController.getStoreFlyers);
// 가게 전단지 상세 조회 (인증 불필요)
router.get('/:store_id/flyers/:flyer_id', StoreController.getStoreFlyer);
// 가게 프로모션 목록 조회 (인증 불필요)
router.get('/:store_id/promotions', StoreController.getStorePromotions);
// 기획 상품 view_count 증가 (인증 불필요)
router.post('/promotions/:promotion_id/view', StoreController.incrementPromotionViewCount);
// 전단지 view_count 증가 (인증 불필요)
router.post('/flyers/:flyer_id/view', StoreController.incrementFlyerViewCount);

export default router;

