import {Router} from 'express';
import {UserController} from '../controllers/UserController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

router.get('/search', UserController.searchUsers);
router.get('/me/profile', authenticateToken, UserController.getMyProfile);
router.get('/me/titles', authenticateToken, UserController.getMyTitles);
router.get('/me/recipes', authenticateToken, UserController.getMyRecipes);
router.get('/me/liked-recipes', authenticateToken, UserController.getMyLikedRecipes);
router.get('/me/followers', authenticateToken, UserController.getMyFollowers);
router.get('/me/following', authenticateToken, UserController.getMyFollowing);
router.put('/me', authenticateToken, UserController.updateProfile);
router.post('/fcm-token', authenticateToken, UserController.updateFcmToken);
router.delete('/fcm-token', authenticateToken, UserController.deleteFcmToken);
router.get('/:userId/profile', authenticateToken, UserController.getUserProfile);
router.get('/:userId/recipes', authenticateToken, UserController.getUserRecipes);
router.get('/:userId/liked-recipes', authenticateToken, UserController.getUserLikedRecipes);
router.get('/:userId/followers', authenticateToken, UserController.getUserFollowers);
router.get('/:userId/following', authenticateToken, UserController.getUserFollowing);
router.post('/:userId/follow', authenticateToken, UserController.followUser);
router.delete('/:userId/follow', authenticateToken, UserController.unfollowUser);

export default router;


