import {Router} from 'express';
import {UploadController} from '../controllers/UploadController';

const router = Router();

/**
 * 업로드 관련 라우트
 */

// 단일 이미지 업로드 (일반용, uploads/ 루트에 저장)
router.post('/image', UploadController.uploadImage);

// 다중 이미지 업로드 (일반용, uploads/ 루트에 저장)
router.post('/images', UploadController.uploadImages);

// 프로필 이미지 업로드 (유저, 상점주, 광고주 모두 사용, uploads/profile/ 폴더에 저장)
router.post('/profile', UploadController.uploadProfile);

// 채팅 미디어 업로드 (이미지/비디오, 50MB 제한, uploads/chat/ 폴더에 저장)
router.post('/chat-media', UploadController.uploadChatMedia);

export default router;

