import {Router, Request, Response, NextFunction} from 'express';
import {AuthController} from '../controllers/AuthController';
import {authenticateToken} from '../middleware/auth';

const router = Router();

/**
 * 인증 관련 라우트
 */

// 약관 정책 조회 라우트에 로그 미들웨어 추가
router.get('/terms/policies', (req: Request, res: Response, next: NextFunction) => {
  console.log('🔗 [라우트] /api/auth/terms/policies 요청 받음');
  console.log('🔗 [라우트] 요청 헤더:', req.headers);
  console.log('🔗 [라우트] 요청 쿼리:', req.query);
  next();
}, AuthController.getTermsPolicies);

// 기본 회원가입 라우트에 로그 미들웨어 추가
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  console.log('🔗 [라우트] POST /api/auth/register 요청 받음');
  console.log('🔗 [라우트] 요청 헤더:', JSON.stringify(req.headers, null, 2));
  console.log('🔗 [라우트] 요청 Body:', JSON.stringify(req.body, null, 2));
  console.log('🔗 [라우트] 요청 Body 타입:', typeof req.body);
  console.log('🔗 [라우트] 요청 Body keys:', Object.keys(req.body || {}));
  console.log('🔗 [라우트] Content-Type:', req.headers['content-type']);
  next();
}, AuthController.registerBasic);

// 사업자 임시 계정 생성
router.post('/register/biz-temp', AuthController.registerBizTemp);

// 이메일 인증 코드 전송
router.post('/email/send-code', AuthController.sendEmailVerificationCode);

// 이메일 인증 코드 검증
router.post('/email/verify-code', AuthController.verifyEmailCode);

// 회원가입 완료 (추가 정보 입력)
router.post('/complete', AuthController.completeRegistration);

// 로그인
router.post('/login', AuthController.login);

// 구글 로그인
router.post('/google', AuthController.googleLogin);

// 애플 로그인
router.post('/apple', AuthController.appleLogin);

// 카카오 로그인
router.post('/kakao', AuthController.kakaoLogin);

// 네이버 로그인
router.post('/naver', AuthController.naverLogin);

// 소셜 연동 해제
router.post('/social/unlink', authenticateToken, AuthController.unlinkSocialAccount);

// 탈퇴 계정 복구
router.post('/restore-deleted', AuthController.restoreDeletedAccount);

// 회원 탈퇴 요청 (앱용 - 인증 필요)
router.post('/delete', authenticateToken, AuthController.requestAccountDeletion);

// 웹에서 회원 탈퇴 링크 요청 (이메일/비밀번호 인증)
router.post('/delete/request-link', AuthController.requestAccountDeletionLink);

// 회원 탈퇴 토큰 검증
router.get('/delete/verify-token', AuthController.verifyDeletionToken);

// 웹에서 회원 탈퇴 확인 (링크 클릭)
router.post('/delete/confirm', AuthController.confirmAccountDeletion);

// 탈퇴 계정 영구 삭제 (관리자 전용)
router.post('/purge-deleted', AuthController.purgeDeletedUsers);

// 비밀번호 변경
router.post('/password/change', authenticateToken, AuthController.changePassword);

// 비밀번호 재설정 요청
router.post('/password-reset-request', AuthController.passwordResetRequest);

// 비밀번호 재설정
router.post('/password-reset', AuthController.passwordReset);

// 프로필 조회 (인증 필요)
router.get('/profile', authenticateToken, AuthController.getProfile);

// 프로필 업데이트 (인증 필요)
router.put('/profile', authenticateToken, AuthController.updateProfile);

export default router;
