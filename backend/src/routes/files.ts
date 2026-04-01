import {Router} from 'express';
import {FileController} from '../controllers/FileController';

const router = Router();

/**
 * 파일 프록시 라우트
 * S3 파일을 EC2의 IAM 역할을 사용하여 가져와서 클라이언트에 제공
 */

// 모든 경로를 FileController로 전달
// 예: /api/files/uploads/recipe/filename.jpg
router.get('*', FileController.proxyFile);

export default router;

