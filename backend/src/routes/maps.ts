import {Router} from 'express';
import {MapController} from '../controllers/MapController';

const router = Router();

/**
 * 지도 관련 라우트
 */
router.get('/recipes', MapController.getMapRecipes);

export default router;


