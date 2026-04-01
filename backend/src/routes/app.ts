import {Router} from 'express';
import {AppController} from '../controllers/AppController';

const router = Router();

/**
 * 앱 정보 관련 라우트
 */

// 고객센터 정보 조회
router.get('/customer-service', AppController.getCustomerServiceInfo);

// QnA 목록 조회
router.get('/qna', AppController.getQnA);

// 테스트 신청 제출
router.post('/test-application', AppController.submitTestApplication);

// 테스트 신청 정보 조회 (관리자)
router.get('/test-application/:applicationId', AppController.getTestApplication);

// 테스트 링크 전송 (관리자)
router.post('/test-application/:applicationId/send-link', AppController.sendTestLink);

// 주소 검색 (카카오 로컬 API)
router.get('/address/search', AppController.searchAddress);

export default router;

