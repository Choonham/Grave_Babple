import {Router} from 'express';
import {BusinessController} from '../controllers/BusinessController';

const router = Router();

/**
 * 사업자 관련 라우트
 */

// 사업자 등록번호 조회
router.post('/inquire', BusinessController.inquireBusiness);

export default router;

