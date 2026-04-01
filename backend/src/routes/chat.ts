import {Router} from 'express';
import {ChatController} from '../controllers/ChatController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 채팅 관련 라우트
 */

// 채팅방 목록 조회
router.get('/rooms', authenticateToken, ChatController.getRooms);

// 채팅방 생성 또는 조회
router.post('/rooms', authenticateToken, ChatController.createOrGetRoom);

// 채팅방 메시지 조회
router.get('/rooms/:roomId/messages', authenticateToken, ChatController.getMessages);

// 메시지 전송
router.post('/rooms/:roomId/messages', authenticateToken, ChatController.sendMessage);

// 채팅방 나가기
router.delete('/rooms/:roomId/leave', authenticateToken, ChatController.leaveRoom);

export default router;

