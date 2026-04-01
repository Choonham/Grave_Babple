import {Router} from 'express';
import {AdvertiserController} from '../controllers/AdvertiserController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 광고주 관련 라우트
 */

// 내 광고주 정보 조회 (인증 필요)
router.get('/me', authenticateToken, AdvertiserController.getMyAdvertiser);

// 내 광고 소재 목록 조회 (인증 필요)
router.get('/me/creatives', authenticateToken, AdvertiserController.getMyCreatives);

// 광고 소재 등록 (인증 필요)
router.post('/me/creatives', authenticateToken, AdvertiserController.createCreative);

// 광고 소재 상세 조회 (인증 필요)
router.get('/me/creatives/:creative_id', authenticateToken, AdvertiserController.getCreative);

// 광고 소재 수정 (인증 필요)
router.put('/me/creatives/:creative_id', authenticateToken, AdvertiserController.updateCreative);

// 광고 소재 삭제 (인증 필요)
router.delete('/me/creatives/:creative_id', authenticateToken, AdvertiserController.deleteCreative);

// 내 캠페인 목록 조회 (인증 필요)
router.get('/me/campaigns', authenticateToken, AdvertiserController.getMyCampaigns);

// 캠페인 생성 (인증 필요)
router.post('/me/campaigns', authenticateToken, AdvertiserController.createCampaign);

// 캠페인 상세 조회 (인증 필요)
router.get('/me/campaigns/:campaign_id', authenticateToken, AdvertiserController.getCampaign);

// 캠페인 수정 (인증 필요)
router.put('/me/campaigns/:campaign_id', authenticateToken, AdvertiserController.updateCampaign);

// 캠페인 삭제 (인증 필요)
router.delete('/me/campaigns/:campaign_id', authenticateToken, AdvertiserController.deleteCampaign);

// 캠페인 상태 변경 (인증 필요)
router.put('/me/campaigns/:campaign_id/status', authenticateToken, AdvertiserController.updateCampaignStatus);

// 광고주 대시보드 통계 조회 (인증 필요)
router.get('/me/stats', authenticateToken, AdvertiserController.getAdvertiserStats);

// 캠페인 상세 통계 조회 (인증 필요)
router.get('/me/campaigns/:campaign_id/stats', authenticateToken, AdvertiserController.getCampaignStats);

// 광고주 등록 (회원가입 중인 사용자도 등록 가능 - body에 user_id 포함)
router.post('/', AdvertiserController.createAdvertiser);

export default router;

