import {Router} from 'express';
import {AdminController} from '../controllers/AdminController';
import {authenticateToken, requireAdmin} from '../middleware/auth';

const router = Router();

/**
 * 관리자 라우트
 */

// 로그인 (인증 불필요)
router.post('/login', AdminController.login);

// 관리자 권한이 필요한 모든 라우트
router.use(authenticateToken);
router.use(requireAdmin);

// 유저 관리
router.get('/users', AdminController.getUsers);
router.post('/users/:userId/ban', AdminController.banUser);
router.post('/users/:userId/unban', AdminController.unbanUser);
router.put('/users/:userId/status', AdminController.updateUserStatus);

// 게시글 관리
router.get('/recipes', AdminController.getRecipes);
router.delete('/recipes/:recipeId', AdminController.deleteRecipe);

// 광고 관리 (캠페인 기준)
router.get('/ads', AdminController.getAds);
router.post('/ads/:campaignId/approve', AdminController.approveAd);
router.post('/ads/:campaignId/reject', AdminController.rejectAd);

export default router;

