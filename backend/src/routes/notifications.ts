import {Router} from 'express';
import {NotificationController} from '../controllers/NotificationController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 알림 관련 라우트
 */

// 알림 목록 조회
router.get('/', authenticateToken, NotificationController.getNotifications);

// 읽지 않은 알림 개수 조회
router.get('/unread-count', authenticateToken, NotificationController.getUnreadCount);

// 알림 읽음 처리
router.put('/:notificationId/read', authenticateToken, NotificationController.markAsRead);

// 모든 알림 읽음 처리
router.put('/read-all', authenticateToken, NotificationController.markAllAsRead);

export default router;

