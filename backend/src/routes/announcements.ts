import {Router} from 'express';
import {AnnouncementController} from '../controllers/AnnouncementController';

const router = Router();

/**
 * 공지사항 관련 라우트
 */

// 공지사항 목록 조회
router.get('/', AnnouncementController.getAnnouncements);

// 공지사항 상세 조회
router.get('/:announceCode', AnnouncementController.getAnnouncementDetail);

export default router;

