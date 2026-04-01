import { Router } from 'express';
import * as Sentry from '@sentry/node';
import authRoutes from './auth';
import recipeRoutes from './recipes';
import ingredientRoutes from './ingredients';
import mapRoutes from './maps';
import userRoutes from './users';
import searchRoutes from './search';
import uploadRoutes from './upload';
import chatRoutes from './chat';
import notificationRoutes from './notifications';
import announcementRoutes from './announcements';
import termsRoutes from './terms';
import appRoutes from './app';
import reportRoutes from './reports';
import storeRoutes from './stores';
import businessRoutes from './business';
import advertiserRoutes from './advertisers';
import adRoutes from './ads';
import adminRoutes from './admin';
import fileRoutes from './files';

const router = Router();

/**
 * Sentry 테스트 엔드포인트 (운영 환경 포함)
 * 보안을 위해 SENTRY_TEST_TOKEN 환경 변수로 인증
 */
router.get('/debug-sentry', (req, res) => {
    const testToken = req.query.token || req.headers['x-test-token'];

    if (!process.env.SENTRY_TEST_TOKEN || testToken !== process.env.SENTRY_TEST_TOKEN) {
        return res.status(403).json({
            success: false,
            message: '권한이 없습니다. 테스트 토큰이 필요합니다.',
        });
    }

    // Sentry 테스트 에러 발생
    throw new Error('Sentry 테스트 에러입니다! 이 에러는 Sentry 대시보드에 기록됩니다.');
});

/**
 * API 라우트 설정
 */

// 인증 관련 라우트
router.use('/auth', authRoutes);

// 레시피 관련 라우트
router.use('/recipes', recipeRoutes);

// 재료 관련 라우트
router.use('/ingredients', ingredientRoutes);

// 지도 관련 라우트
router.use('/maps', mapRoutes);

// 사용자 관련 라우트
router.use('/users', userRoutes);

// 검색 관련 라우트
router.use('/search', searchRoutes);

// 업로드 관련 라우트
router.use('/upload', uploadRoutes);

// 채팅 관련 라우트
router.use('/chat', chatRoutes);

// 알림 관련 라우트
router.use('/notifications', notificationRoutes);

// 공지사항 관련 라우트
router.use('/announcements', announcementRoutes);

// 약관 관련 라우트
router.use('/terms', termsRoutes);

// 앱 정보 관련 라우트
router.use('/app', appRoutes);

// 상점 관련 라우트
router.use('/stores', storeRoutes);

// 사업자 관련 라우트
router.use('/business', businessRoutes);

// 광고주 관련 라우트
router.use('/advertisers', advertiserRoutes);

// 광고 관련 라우트
router.use('/ads', adRoutes);

// 신고 및 숨김 처리 관련 라우트
router.use('/reports', reportRoutes);

// 관리자 관련 라우트
router.use('/admin', adminRoutes);

// 파일 프록시 라우트 (S3 파일을 EC2를 통해 제공)
router.use('/files', fileRoutes);

export default router;