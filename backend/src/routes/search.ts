import {Router} from 'express';
import {SearchController} from '../controllers/SearchController';

const router = Router();

router.post('/log', SearchController.recordSearch);
router.get('/trending', SearchController.getTrendingSearches);

export default router;
