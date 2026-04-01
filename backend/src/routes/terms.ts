import {Router} from 'express';
import {TermsController} from '../controllers/TermsController';

const router = Router();

/**
 * 약관 관련 라우트
 */

// 약관 목록 조회
router.get('/', TermsController.getTerms);

// 약관 상세 조회
router.get('/:termId', TermsController.getTermDetail);

export default router;

