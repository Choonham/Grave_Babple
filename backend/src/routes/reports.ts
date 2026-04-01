import {Router} from 'express';
import {ReportController} from '../controllers/ReportController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 신고 및 숨김 처리 관련 라우트
 */

// 사용자 신고
router.post('/users', authenticateToken, ReportController.reportUser);

// 사용자 숨김 처리
router.post('/users/:userId/hide', authenticateToken, ReportController.hideUser);

// 사용자 숨김 해제
router.delete('/users/:userId/hide', authenticateToken, ReportController.unhideUser);

// 숨김 처리한 사용자 목록 조회
router.get('/users/hidden', authenticateToken, ReportController.getHiddenUsers);

export default router;

