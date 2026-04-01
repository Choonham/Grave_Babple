import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User, Term, UserTermAgree, LinkedEmail } from '../models/User';
import { EmailVerification, AccountDeletionToken } from '../models/Auth';
import { EmailService } from '../services/EmailService';
import { s3Service } from '../services/S3Service';
import { normalizeToRelativePath } from '../utils/imageUrl';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { In } from 'typeorm';
import fs from 'fs';
import path from 'path';

/**
 * 인증 컨트롤러
 * 로그인, 회원가입, 약관 조회 등의 인증 관련 기능을 담당
 */
const googleClientId =
  process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const googleOAuthClient = googleClientId ? new OAuth2Client(googleClientId) : null;

const EMAIL_CODE_EXPIRATION_MS = 5 * 60 * 1000; // 5분
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000; // 60초
const EMAIL_CODE_MAX_ATTEMPTS = 5;

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6자리
};

export class AuthController {
  /**
   * 약관 정책 조회 (정적 파일 기반)
   * GET /api/auth/terms/policies?type=0 또는 ?type=0,1
   * type 파라미터:
   *   - 없음: 모든 약관 반환 (기존 호환성)
   *   - 0: 일반 약관만 반환
   *   - 0,1: 일반 약관 + 비즈니스 약관 반환
   */
  static async getTermsPolicies(req: Request, res: Response) {
    try {
      console.log('📋 [약관 조회] 요청 받음');
      console.log('📋 [약관 조회] 요청 URL:', req.url);
      console.log('📋 [약관 조회] 요청 메서드:', req.method);
      console.log('📋 [약관 조회] 쿼리 파라미터:', req.query);

      // type 파라미터 파싱
      const typeParam = req.query.type as string | undefined;
      let requestedTypes: number[] = [];

      if (typeParam) {
        requestedTypes = typeParam.split(',').map(t => parseInt(t.trim(), 10)).filter(t => !isNaN(t));
        console.log('📋 [약관 조회] type 필터 적용:', requestedTypes);
      }

      // 약관 파일 정의
      const termsConfig = [
        {
          id: 1,
          title: '서비스 이용 약관',
          filename: 'service_terms.md',
          type: 0, // 일반 약관
          required: true,
        },
        {
          id: 2,
          title: '개인정보 처리방침',
          filename: 'privacy_policy.md',
          type: 0, // 일반 약관
          required: true,
        },
        {
          id: 3,
          title: '위치 정보 처리 방침',
          filename: 'location_data_policy.md',
          type: 0, // 일반 약관
          required: false,
        },
        {
          id: 4,
          title: '비즈니스 이용약관',
          filename: 'business_terms.md',
          type: 1, // 비즈니스 약관
          required: false,
        },
      ];

      // type 필터링
      let filteredTerms = termsConfig;
      if (requestedTypes.length > 0) {
        filteredTerms = termsConfig.filter(term => requestedTypes.includes(term.type));
      }

      console.log(`📊 [약관 조회] 조회할 약관 개수: ${filteredTerms.length}`);

      // 약관 파일을 S3에서 읽기
      const formattedTerms = [];

      for (const termConfig of filteredTerms) {
        try {
          // S3에서 약관 파일 읽기
          const s3Key = `docs/terms/${termConfig.filename}`;
          const content = await s3Service.getFile(s3Key);

          formattedTerms.push({
            term_id: termConfig.id,
            id: termConfig.id,
            title: termConfig.title,
            content: content,
            required: termConfig.required,
            type: termConfig.type,
          });

          console.log(`✅ [약관 조회] S3에서 약관 파일 읽기 완료: ${termConfig.filename}`);
        } catch (fileError) {
          console.error(`❌ [약관 조회] S3에서 약관 파일 읽기 실패: ${termConfig.filename}`, fileError);
          // 개별 파일 읽기 실패 시에도 다른 약관은 계속 읽기
          continue;
        }
      }

      if (formattedTerms.length === 0) {
        console.warn('⚠️ [약관 조회] 읽어올 약관이 없습니다.');
        return res.status(404).json({
          success: false,
          message: '약관 파일을 찾을 수 없습니다.',
        });
      }

      console.log(`✅ [약관 조회] 총 ${formattedTerms.length}개의 약관 조회 완료`);

      const response = {
        success: true,
        data: formattedTerms,
      };

      console.log('✅ [약관 조회] 응답 전송 완료');
      res.json(response);
      return;
    } catch (error) {
      console.error('❌ [약관 조회] 오류 발생:', error);
      console.error('❌ [약관 조회] 오류 상세:', (error as Error).message);
      console.error('❌ [약관 조회] 오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 이메일 인증 코드 전송
   * POST /api/auth/email/send-code
   */
  static async sendEmailVerificationCode(req: Request, res: Response) {
    try {
      const { email, purpose } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          message: '이메일을 입력해주세요.',
        });
      }

      const normalizedPurpose = AuthController.normalizePurpose(purpose);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { email, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '해당 이메일로 가입된 계정을 찾을 수 없습니다.',
        });
      }

      // 이메일 인증 완료 체크는 회원가입 시에만 적용
      if (normalizedPurpose === 'SIGNUP' && user.is_email_verified) {
        return res.json({
          success: true,
          message: '이미 이메일 인증이 완료된 계정입니다.',
          data: { verified: true },
        });
      }

      const verificationRepository = AppDataSource.getRepository(EmailVerification);
      // email만으로 기존 레코드 찾기 (unique 제약조건 때문에 email당 하나만 존재)
      const existingRecord = await verificationRepository.findOne({
        where: { email },
      });

      const now = new Date();
      if (
        existingRecord &&
        existingRecord.last_sent_at &&
        now.getTime() - existingRecord.last_sent_at.getTime() < EMAIL_CODE_COOLDOWN_MS
      ) {
        const remaining = Math.ceil(
          (EMAIL_CODE_COOLDOWN_MS - (now.getTime() - existingRecord.last_sent_at.getTime())) / 1000,
        );
        return res.status(429).json({
          success: false,
          message: `인증 코드는 아직 재전송할 수 없습니다. ${remaining}초 후 다시 시도해주세요.`,
          retry_after_seconds: remaining,
        });
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(now.getTime() + EMAIL_CODE_EXPIRATION_MS);

      if (existingRecord) {
        // 기존 레코드가 있으면 업데이트
        existingRecord.code = code;
        existingRecord.expires_at = expiresAt;
        existingRecord.attempt_count = 0;
        existingRecord.last_sent_at = now;
        existingRecord.send_count = (existingRecord.send_count || 0) + 1;
        existingRecord.is_verified = false;
        existingRecord.verified_at = undefined;
        existingRecord.purpose = normalizedPurpose;
        await verificationRepository.save(existingRecord);
      } else {
        // 기존 레코드가 없으면 새로 생성
        const newRecord = verificationRepository.create({
          email,
          code,
          expires_at: expiresAt,
          attempt_count: 0,
          send_count: 1,
          last_sent_at: now,
          is_verified: false,
          purpose: normalizedPurpose,
        });
        await verificationRepository.save(newRecord);
      }

      await EmailService.sendVerificationCode(email, code);

      return res.json({
        success: true,
        message: '인증번호가 이메일로 전송되었습니다.',
        data: {
          expires_in_seconds: EMAIL_CODE_EXPIRATION_MS / 1000,
          cooldown_seconds: EMAIL_CODE_COOLDOWN_MS / 1000,
          purpose: normalizedPurpose,
        },
      });
    } catch (error) {
      console.error('❌ [이메일 인증] 코드 전송 실패:', error);
      return res.status(500).json({
        success: false,
        message: '인증번호 전송 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }

  /**
   * 이메일 인증 코드 검증
   * POST /api/auth/email/verify-code
   */
  static async verifyEmailCode(req: Request, res: Response) {
    try {
      const { email, code, purpose } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          message: '이메일과 인증번호를 모두 입력해주세요.',
        });
      }

      const normalizedPurpose = AuthController.normalizePurpose(purpose);
      await AuthController.validateEmailCode(email, String(code).trim(), normalizedPurpose);

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email, delete_yn: false } });
      if (user && !user.is_email_verified) {
        user.is_email_verified = true;
        await userRepository.save(user);
      }

      return res.json({
        success: true,
        message: '이메일 인증이 완료되었습니다.',
        data: { verified: true, purpose: normalizedPurpose },
      });
    } catch (error) {
      console.error('❌ [이메일 인증] 검증 실패:', error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || '인증번호 확인 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
      });
    }
  }

  /**
   * 소셜 연동 해제
   * POST /api/auth/social/unlink
   */
  static async unlinkSocialAccount(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.user_id) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const { provider, providerToken } = req.body;
      if (!provider) {
        return res.status(400).json({
          success: false,
          message: '해제할 소셜 계정을 지정해주세요.',
        });
      }

      const normalizedProvider = String(provider).toUpperCase();
      const userRepository = AppDataSource.getRepository(User);
      const linkedEmailRepository = AppDataSource.getRepository(LinkedEmail);

      const user = await userRepository.findOne({
        where: { user_id: authUser.user_id, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      if (!user.social_provider) {
        return res.json({
          success: true,
          message: '이미 일반 계정입니다.',
          data: { social_provider: null },
        });
      }

      if (user.social_provider !== normalizedProvider) {
        return res.status(400).json({
          success: false,
          message: `현재 ${user.social_provider} 계정만 연동되어 있습니다.`,
        });
      }

      if (normalizedProvider === 'GOOGLE' && providerToken && googleOAuthClient) {
        try {
          await googleOAuthClient.revokeToken(providerToken);
          console.log('✅ [소셜 연동 해제] 구글 토큰 해제 완료');
        } catch (error) {
          console.error('⚠️ [소셜 연동 해제] 구글 토큰 해제 실패:', error);
        }
      }

      user.social_provider = null;
      await userRepository.save(user);

      await linkedEmailRepository.delete({
        user_id: user.user_id,
        platform: normalizedProvider.toLowerCase(),
      });

      return res.json({
        success: true,
        message: '소셜 연동이 해제되었습니다.',
        data: {
          social_provider: null,
        },
      });
    } catch (error) {
      console.error('❌ [소셜 연동 해제] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '소셜 연동 해제 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 계정 삭제 요청
   * POST /api/auth/delete
   */
  static async requestAccountDeletion(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.user_id) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const { password, verification_code, verificationCode } = req.body;
      const resolvedVerificationCode = verification_code || verificationCode;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: authUser.user_id, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      const isSocialAccount = user.social_provider && user.social_provider !== 'LOCAL';

      if (isSocialAccount) {
        if (!resolvedVerificationCode) {
          return res.status(400).json({
            success: false,
            message: '이메일 인증번호를 입력해주세요.',
          });
        }
        await AuthController.validateEmailCode(
          user.email,
          String(resolvedVerificationCode),
          'ACCOUNT_DELETE',
        );
      } else {
        if (!password || typeof password !== 'string') {
          return res.status(400).json({
            success: false,
            message: '비밀번호를 입력해주세요.',
          });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: '비밀번호가 올바르지 않습니다.',
          });
        }
      }

      user.delete_yn = true;
      user.deleted_at = new Date();
      await userRepository.save(user);

      return res.json({
        success: true,
        message: '회원 탈퇴가 요청되었습니다. 90일 후 완전히 삭제됩니다.',
        data: {
          delete_yn: user.delete_yn,
          deleted_at: user.deleted_at,
        },
      });
    } catch (error) {
      console.error('❌ [회원 탈퇴] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '회원 탈퇴 요청 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 웹에서 회원 탈퇴 링크 요청 (이메일/비밀번호 인증)
   * POST /api/auth/delete/request-link
   */
  static async requestAccountDeletionLink(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // 입력 검증
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: '유효한 이메일 주소를 입력해주세요.',
        });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          message: '비밀번호를 입력해주세요.',
        });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { email: trimmedEmail, delete_yn: false },
      });

      if (!user) {
        // 보안을 위해 구체적인 오류 메시지 제공하지 않음
        return res.status(400).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      // 소셜 계정인 경우 비밀번호 검증 불가
      if (user.social_provider && user.social_provider !== 'LOCAL') {
        return res.status(400).json({
          success: false,
          message: '소셜 계정은 앱에서 탈퇴할 수 있습니다.',
        });
      }

      // 비밀번호 검증
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      // 기존 토큰 무효화 (있으면)
      const tokenRepository = AppDataSource.getRepository(AccountDeletionToken);
      const existingTokens = await tokenRepository.find({
        where: { user_id: user.user_id, is_used: false },
      });
      for (const token of existingTokens) {
        token.is_used = true;
        await tokenRepository.save(token);
      }

      // 새 토큰 생성
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

      const deletionToken = tokenRepository.create({
        user_id: user.user_id,
        token,
        email: trimmedEmail,
        expires_at: expiresAt,
        is_used: false,
      });
      await tokenRepository.save(deletionToken);

      // 이메일 전송
      const WEB_BASE_URL = process.env.WEB_BASE_URL || 'https://babplealpha.slowflowsoft.com';
      const deletionLink = `${WEB_BASE_URL}/account/delete/confirm?token=${token}`;

      await EmailService.sendAccountDeletionLinkEmail(
        user.nickname || user.email,
        trimmedEmail,
        deletionLink,
      );

      console.log(`✅ [회원 탈퇴 링크 요청] ${trimmedEmail} - 토큰 생성 및 메일 발송`);

      return res.json({
        success: true,
        message: '회원 탈퇴 링크가 이메일로 발송되었습니다. 이메일을 확인해주세요.',
      });
    } catch (error) {
      console.error('❌ [회원 탈퇴 링크 요청] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '회원 탈퇴 링크 요청 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 웹에서 회원 탈퇴 링크를 통한 실제 탈퇴 처리
   * POST /api/auth/delete/confirm
   */
  static async confirmAccountDeletion(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 링크입니다.',
        });
      }

      const tokenRepository = AppDataSource.getRepository(AccountDeletionToken);
      const deletionToken = await tokenRepository.findOne({
        where: { token, is_used: false },
      });

      if (!deletionToken) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않거나 이미 사용된 링크입니다.',
        });
      }

      // 만료 확인
      if (new Date() > deletionToken.expires_at) {
        return res.status(400).json({
          success: false,
          message: '링크가 만료되었습니다. 새로운 탈퇴 요청을 해주세요.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: deletionToken.user_id, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // 탈퇴 처리
      user.delete_yn = true;
      user.deleted_at = new Date();
      await userRepository.save(user);

      // 토큰 사용 처리
      deletionToken.is_used = true;
      deletionToken.used_at = new Date();
      await tokenRepository.save(deletionToken);

      console.log(`✅ [회원 탈퇴 완료] ${deletionToken.email} - 탈퇴 처리 완료`);

      return res.json({
        success: true,
        message: '회원 탈퇴가 완료되었습니다. 90일 후 모든 데이터가 영구적으로 삭제됩니다.',
      });
    } catch (error) {
      console.error('❌ [회원 탈퇴 확인] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '회원 탈퇴 처리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 회원 탈퇴 토큰 검증 (페이지 로드 시)
   * GET /api/auth/delete/verify-token?token=xxx
   */
  static async verifyDeletionToken(req: Request, res: Response) {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 토큰입니다.',
        });
      }

      const tokenRepository = AppDataSource.getRepository(AccountDeletionToken);
      const deletionToken = await tokenRepository.findOne({
        where: { token: token as string, is_used: false },
      });

      if (!deletionToken) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않거나 이미 사용된 링크입니다.',
        });
      }

      // 만료 확인
      if (new Date() > deletionToken.expires_at) {
        return res.status(400).json({
          success: false,
          message: '링크가 만료되었습니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: deletionToken.user_id },
        select: ['user_id', 'nickname', 'email'],
      });

      if (!user || user.delete_yn) {
        return res.status(404).json({
          success: false,
          message: '이미 탈퇴된 계정이거나 사용자를 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          email: user.email,
          nickname: user.nickname,
        },
      });
    } catch (error) {
      console.error('❌ [탈퇴 토큰 검증] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '토큰 검증 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 탈퇴 예정 사용자 영구 삭제
   * POST /api/auth/purge-deleted (requires x-admin-secret header)
   */
  static async purgeDeletedUsers(req: Request, res: Response) {
    try {
      const adminSecret = req.headers['x-admin-secret'];
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          success: false,
          message: '접근이 거부되었습니다.',
        });
      }

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const userRepository = AppDataSource.getRepository(User);
      const linkedEmailRepository = AppDataSource.getRepository(LinkedEmail);

      const usersToPurge = await userRepository.find({
        where: {
          delete_yn: true,
        },
      });

      const purgeTargets = usersToPurge.filter(
        user => user.deleted_at && user.deleted_at <= ninetyDaysAgo,
      );

      for (const user of purgeTargets) {
        await linkedEmailRepository.delete({ user_id: user.user_id });
        await userRepository.delete({ user_id: user.user_id });
      }

      return res.json({
        success: true,
        message: '탈퇴 유예 기간이 지난 계정이 삭제되었습니다.',
        data: {
          purged: purgeTargets.length,
        },
      });
    } catch (error) {
      console.error('❌ [탈퇴 계정 정리] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '탈퇴 계정 정리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 탈퇴 계정 복구
   * POST /api/auth/restore-deleted
   */
  static async restoreDeletedAccount(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '복구할 사용자 ID가 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: userId },
        withDeleted: true,
      });

      if (!user || !user.delete_yn) {
        return res.status(404).json({
          success: false,
          message: '탈퇴된 사용자를 찾을 수 없습니다.',
        });
      }

      user.delete_yn = false;
      user.deleted_at = undefined;
      await userRepository.save(user);

      return res.json({
        success: true,
        message: '계정이 복구되었습니다. 다시 로그인해 주세요.',
      });
    } catch (error) {
      console.error('❌ [계정 복구] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '계정 복구 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 기본 회원가입
   * POST /api/auth/register
   * 이메일, 비밀번호, 약관 동의만 받아서 처리
   */
  static async registerBasic(req: Request, res: Response) {
    try {
      console.log('📝 [회원가입] 컨트롤러 요청 받음');
      console.log('📝 [회원가입] 요청 Body 전체:', JSON.stringify(req.body, null, 2));
      console.log('📝 [회원가입] 요청 Body 타입:', typeof req.body);
      console.log('📝 [회원가입] 요청 Body가 객체인가?', req.body instanceof Object);
      console.log('📝 [회원가입] 요청 Body keys:', Object.keys(req.body || {}));

      const { email, password, terms } = req.body;

      console.log('📝 [회원가입] 파싱된 데이터:');
      console.log('   - email:', email, '(타입:', typeof email, ', 존재:', !!email, ')');
      console.log('   - password:', password ? '***' : undefined, '(타입:', typeof password, ', 존재:', !!password, ')');
      console.log('   - terms:', terms, '(타입:', typeof terms, ', 배열인가?', Array.isArray(terms), ', 존재:', !!terms, ')');

      if (terms && Array.isArray(terms)) {
        console.log('   - terms 배열 길이:', terms.length);
        terms.forEach((term, index) => {
          console.log(`   - terms[${index}]:`, JSON.stringify(term));
        });
      }

      // 필수 정보 검증
      if (!email || !password || !terms) {
        console.error('❌ [회원가입] 필수 정보 누락:');
        console.error('   - email:', email ? '있음' : '없음');
        console.error('   - password:', password ? '있음' : '없음');
        console.error('   - terms:', terms ? '있음' : '없음');

        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다.',
          details: {
            hasEmail: !!email,
            hasPassword: !!password,
            hasTerms: !!terms,
            receivedKeys: Object.keys(req.body || {}),
          },
        });
      }

      // 약관은 배열이어야 함
      if (!Array.isArray(terms) || terms.length === 0) {
        console.error('❌ [회원가입] 약관 배열 오류:');
        console.error('   - terms 타입:', typeof terms);
        console.error('   - terms 배열인가?', Array.isArray(terms));
        console.error('   - terms 길이:', terms?.length);

        return res.status(400).json({
          success: false,
          message: '약관 동의 정보가 필요합니다.',
        });
      }

      // 이메일 중복 확인 및 미완성 계정 처리
      const userRepository = AppDataSource.getRepository(User);
      const existingUser = await userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        // 임시 nickname 패턴인지 확인 (user_로 시작하는 임시 nickname)
        const isIncompleteUser = existingUser.nickname && existingUser.nickname.startsWith('user_');

        if (isIncompleteUser) {
          // 미완성 계정이면 기존 계정 삭제
          console.log(`🗑️ [회원가입] 기존 미완성 계정 삭제: user_id=${existingUser.user_id}, email=${email}`);

          // 약관 동의 정보도 삭제
          const userTermAgreeRepository = AppDataSource.getRepository(UserTermAgree);
          await userTermAgreeRepository.delete({ user_id: existingUser.user_id });

          // 사용자 삭제
          await userRepository.remove(existingUser);
          console.log(`✅ [회원가입] 기존 미완성 계정 삭제 완료`);
        } else {
          // 완성된 계정이면 에러 반환
          return res.status(409).json({
            success: false,
            message: '이미 존재하는 이메일입니다.',
          });
        }
      }

      // 비밀번호 해시화
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // 임시 nickname 생성 (나중에 complete에서 업데이트됨)
      const tempNickname = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 사용자 생성
      const newUser = userRepository.create({
        email,
        password_hash: passwordHash,
        nickname: tempNickname, // 임시 nickname
        delete_yn: false,
      });

      const savedUser = await userRepository.save(newUser);

      // 약관 동의 처리
      const userTermAgreeRepository = AppDataSource.getRepository(UserTermAgree);

      for (const termAgree of terms) {
        if (!termAgree.term_id || termAgree.agreed === undefined) {
          continue; // 유효하지 않은 약관 항목은 건너뛰기
        }

        const userTermAgree = userTermAgreeRepository.create({
          user_id: savedUser.user_id,
          term_id: termAgree.term_id,
          agree: termAgree.agreed,
        });
        await userTermAgreeRepository.save(userTermAgree);
      }

      return res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: {
          user_id: savedUser.user_id,
          email: savedUser.email,
        },
      });
    } catch (error) {
      console.error('회원가입 오류:', error);
      console.error('오류 상세:', (error as Error).message);
      console.error('오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '회원가입 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message, // 개발 중에만 오류 메시지 포함
      });
    }
  }

  /**
   * 사업자 임시 계정 생성
   * POST /api/auth/register/biz-temp
   * 이메일, 비밀번호, 계정 유형만 받아서 임시 계정 생성
   * 같은 이메일로 재가입 시 기존 임시 계정 삭제 후 새 계정 생성
   */
  static async registerBizTemp(req: Request, res: Response) {
    try {
      console.log('📝 [사업자 임시 계정 생성] 컨트롤러 요청 받음');
      console.log('📝 [사업자 임시 계정 생성] 요청 Body:', JSON.stringify(req.body, null, 2));

      const { email, password, account_type, terms } = req.body;

      // 필수 정보 검증
      if (!email || !password || !account_type) {
        console.error('❌ [사업자 임시 계정 생성] 필수 정보 누락:');
        console.error('   - email:', email ? '있음' : '없음');
        console.error('   - password:', password ? '있음' : '없음');
        console.error('   - account_type:', account_type ? '있음' : '없음');

        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다.',
          details: {
            hasEmail: !!email,
            hasPassword: !!password,
            hasAccountType: !!account_type,
          },
        });
      }

      // account_type 유효성 검증 (1: mart, 2: advertiser)
      const role = account_type === 'mart' ? 1 : account_type === 'advertiser' ? 2 : null;
      if (role === null) {
        return res.status(400).json({
          success: false,
          message: '올바른 계정 유형을 선택해주세요. (mart 또는 advertiser)',
        });
      }

      // 이메일 중복 확인 및 임시 계정 처리
      const userRepository = AppDataSource.getRepository(User);
      const existingUser = await userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        // 임시 nickname 패턴인지 확인 (user_로 시작하는 임시 nickname)
        const isIncompleteUser = existingUser.nickname && existingUser.nickname.startsWith('user_');

        if (isIncompleteUser) {
          // 미완성 계정이면 기존 계정 삭제
          console.log(`🗑️ [사업자 임시 계정 생성] 기존 임시 계정 삭제: user_id=${existingUser.user_id}, email=${email}`);

          // 약관 동의 정보도 삭제
          const userTermAgreeRepository = AppDataSource.getRepository(UserTermAgree);
          await userTermAgreeRepository.delete({ user_id: existingUser.user_id });

          // 사용자 삭제
          await userRepository.remove(existingUser);
          console.log(`✅ [사업자 임시 계정 생성] 기존 임시 계정 삭제 완료`);
        } else {
          // 완성된 계정이면 에러 반환
          return res.status(409).json({
            success: false,
            message: '이미 존재하는 이메일입니다.',
          });
        }
      }

      // 비밀번호 해시화
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // 임시 nickname 생성 (나중에 complete에서 업데이트됨)
      const tempNickname = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 사용자 생성
      const newUser = userRepository.create({
        email,
        password_hash: passwordHash,
        nickname: tempNickname, // 임시 nickname
        role, // 사업자 계정 유형 (1: mart, 2: advertiser)
        delete_yn: false,
      });

      // 비즈니스 계정은 기본적으로 PENDING 상태로 설정
      if ((newUser as any).status !== undefined) {
        (newUser as any).status = 'PENDING';
      }

      const savedUser = await userRepository.save(newUser);
      console.log(`✅ [사업자 임시 계정 생성] 계정 생성 완료: user_id=${savedUser.user_id}, email=${email}, role=${role}`);

      // 약관 동의 정보 저장
      if (terms && Array.isArray(terms)) {
        const userTermAgreeRepository = AppDataSource.getRepository(UserTermAgree);
        for (const termAgree of terms) {
          const userTermAgree = userTermAgreeRepository.create({
            user_id: savedUser.user_id,
            term_id: termAgree.term_id,
            agree: termAgree.agreed,
          });
          await userTermAgreeRepository.save(userTermAgree);
          console.log(`✅ [사업자 임시 계정 생성] 약관 동의 저장: term_id=${termAgree.term_id}, agreed=${termAgree.agreed}`);
        }
        console.log(`✅ [사업자 임시 계정 생성] 약관 동의 정보 저장 완료 (${terms.length}개)`);
      } else {
        console.log('⚠️ [사업자 임시 계정 생성] 약관 동의 정보가 없습니다.');
      }

      return res.status(201).json({
        success: true,
        message: '사업자 임시 계정이 생성되었습니다.',
        data: {
          user_id: savedUser.user_id,
          email: savedUser.email,
          role: savedUser.role,
        },
      });
    } catch (error) {
      console.error('❌ [사업자 임시 계정 생성] 오류 발생:', error);
      console.error('❌ [사업자 임시 계정 생성] 오류 상세:', (error as Error).message);
      console.error('❌ [사업자 임시 계정 생성] 오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '사업자 임시 계정 생성 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 회원가입 완료 (추가 정보 입력)
   * POST /api/auth/complete
   * 전화번호, 닉네임 등 부가 정보를 받아서 처리
   */
  static async completeRegistration(req: Request, res: Response) {
    try {
      console.log('📝 [회원가입 완료] 컨트롤러 요청 받음');
      console.log('📝 [회원가입 완료] 요청 Body:', JSON.stringify(req.body, null, 2));

      const { user_id, nickname, introduction, phone_number, gender, age_group, location_text, profile_image_url } = req.body;

      if (!user_id) {
        console.error('❌ [회원가입 완료] user_id가 없습니다.');
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id, delete_yn: false },
      });

      if (!user) {
        console.error(`❌ [회원가입 완료] 사용자를 찾을 수 없습니다: user_id=${user_id}`);
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      console.log(`✅ [회원가입 완료] 사용자 찾음: user_id=${user.user_id}, email=${user.email}`);

      // 닉네임 중복 확인 (nickname이 제공된 경우)
      if (nickname && nickname !== user.nickname) {
        const existingNickname = await userRepository.findOne({
          where: { nickname, delete_yn: false },
        });

        if (existingNickname) {
          console.error(`❌ [회원가입 완료] 닉네임 중복: ${nickname}`);
          return res.status(409).json({
            success: false,
            message: '이미 사용 중인 닉네임입니다.',
          });
        }
      }

      // 추가 정보 업데이트
      if (nickname) {
        user.nickname = nickname;
        console.log(`✅ [회원가입 완료] 닉네임 업데이트: ${nickname}`);
      }
      if (phone_number) {
        user.phone_number = phone_number;
        console.log(`✅ [회원가입 완료] 전화번호 업데이트: ${phone_number}`);
      }

      if (location_text) {
        user.location_text = location_text;
        console.log(`✅ [회원가입 완료] 위치 업데이트: ${location_text}`);
      }
      if (introduction !== undefined) {
        user.introduction = introduction || null;
        console.log(`✅ [회원가입 완료] 소개글 업데이트: ${introduction || '(없음)'}`);
      }
      if (profile_image_url !== undefined) {
        // S3 URL을 상대 경로로 변환하여 저장
        user.profile_image_url = normalizeToRelativePath(profile_image_url);
        console.log(`✅ [회원가입 완료] 프로필 이미지 업데이트: ${user.profile_image_url || '(없음)'}`);
      }

      await userRepository.save(user);
      console.log(`✅ [회원가입 완료] 사용자 정보 저장 완료`);

      return res.json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        data: {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          gender: user.gender,
          age_group: user.age_group,
          location_text: user.location_text,
        },
      });
    } catch (error) {
      console.error('회원가입 완료 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 로그인
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response) {
    try {
      console.log('🔐 [로그인] 컨트롤러 요청 받음');
      console.log('🔐 [로그인] 요청 Body:', JSON.stringify(req.body, null, 2));

      const {
        email,
        password,
        fcmToken,
        deviceId,
        latitude,
        longitude,
        location_text,
      } = req.body;

      if (!email || !password) {
        console.error('❌ [로그인] 필수 정보 누락: email 또는 password가 없습니다.');
        return res.status(400).json({
          success: false,
          message: '이메일과 비밀번호를 입력해주세요.',
        });
      }

      console.log(`🔐 [로그인] 이메일로 사용자 찾기: ${email}`);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { email, delete_yn: false },
      });

      if (!user) {
        console.error(`❌ [로그인] 사용자를 찾을 수 없음: ${email}`);
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      console.log(`✅ [로그인] 사용자 찾음: user_id=${user.user_id}, email=${user.email}`);

      // 비밀번호 확인
      console.log('🔐 [로그인] 비밀번호 확인 중...');
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        console.error(`❌ [로그인] 비밀번호 불일치: ${email}`);
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      console.log('✅ [로그인] 비밀번호 확인 완료');

      let updatedLocation: { latitude: number; longitude: number } | null = null;
      let locationUpdated = false;
      const latitudeNumber =
        latitude !== undefined && latitude !== null ? Number(latitude) : undefined;
      const longitudeNumber =
        longitude !== undefined && longitude !== null ? Number(longitude) : undefined;

      // 로그인 시 위치 정보 업데이트는 하지 않음
      // 위치 정보는 회원가입 또는 프로필 수정 시에만 업데이트해야 함
      // 단, GPS 좌표는 로그인 시 현재 위치로 업데이트할 수 있음 (선택사항)
      // 하지만 location_text는 회원가입 시 설정한 값을 유지해야 함

      if (
        typeof latitudeNumber === 'number' &&
        !Number.isNaN(latitudeNumber) &&
        typeof longitudeNumber === 'number' &&
        !Number.isNaN(longitudeNumber)
      ) {
        // GPS 좌표는 업데이트 (현재 위치 추적용)
        user.location = {
          type: 'Point',
          coordinates: [longitudeNumber, latitudeNumber],
        } as any;
        locationUpdated = true;
        updatedLocation = {
          latitude: latitudeNumber,
          longitude: longitudeNumber,
        };
        console.log('📍 [로그인] 사용자 GPS 좌표 업데이트:', updatedLocation);
      }

      // location_text는 로그인 시 업데이트하지 않음
      // 사용자가 회원가입 시 설정한 주소를 유지해야 함

      if (locationUpdated) {
        await userRepository.save(user);
        console.log('✅ [로그인] 사용자 GPS 좌표 정보 저장 완료');
      }

      // JWT 토큰 생성
      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      console.log('🔐 [로그인] JWT 토큰 생성 중...');
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          role: user.role ?? 0,
        },
        jwtSecret,
        { expiresIn: '24h' },
      );
      console.log('✅ [로그인] JWT 토큰 생성 완료');

      // FCM 토큰 및 디바이스 ID 저장 (선택사항)
      if (fcmToken && fcmToken !== 'fcm_token' && fcmToken.trim().length > 0) {
        console.log('📱 [로그인] FCM 토큰 저장:', fcmToken.substring(0, 20) + '...');
        user.fcm_token = fcmToken.trim();
        await userRepository.save(user);
        console.log('✅ [로그인] FCM 토큰이 DB에 저장되었습니다.');
      } else {
        console.log('⚠️ [로그인] FCM 토큰이 유효하지 않아 저장하지 않습니다:', fcmToken);
      }
      if (deviceId) {
        console.log('📱 [로그인] 디바이스 ID 저장:', deviceId);
        // TODO: 디바이스 ID 저장 로직 추가
      }

      let finalLocation = updatedLocation;
      if (!finalLocation) {
        const existingLocation = await userRepository
          .createQueryBuilder('usr')
          .select('ST_Y(usr.location::geometry)', 'latitude')
          .addSelect('ST_X(usr.location::geometry)', 'longitude')
          .where('usr.user_id = :userId', { userId: user.user_id })
          .andWhere('usr.location IS NOT NULL')
          .getRawOne();

        if (
          existingLocation &&
          existingLocation.latitude !== null &&
          existingLocation.longitude !== null
        ) {
          finalLocation = {
            latitude: Number(existingLocation.latitude),
            longitude: Number(existingLocation.longitude),
          };
        }
      }

      const responseData = {
        token,
        user: {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          gender: user.gender,
          age_group: user.age_group,
          location_text: user.location_text,
          location: finalLocation,
          social_provider: user.social_provider || null,
          role: user.role ?? 0,
          view_mode: user.view_mode || null,
        },
      };

      console.log('✅ [로그인] 로그인 성공, 응답 전송');
      console.log('   - user_id:', user.user_id);
      console.log('   - email:', user.email);
      console.log('   - nickname:', user.nickname);

      return res.json({
        success: true,
        message: '로그인 성공',
        data: responseData,
      });
    } catch (error) {
      console.error('로그인 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 구글 로그인
   * POST /api/auth/google
   */
  static async googleLogin(req: Request, res: Response) {
    try {
      const { idToken, fcmToken, deviceId, latitude, longitude, location_text } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          message: 'Google 인증 토큰이 필요합니다.',
        });
      }

      if (!googleClientId || !googleOAuthClient) {
        console.error('❌ [구글 로그인] GOOGLE_CLIENT_ID 환경 변수가 설정되지 않았습니다.');
        return res.status(500).json({
          success: false,
          message: '서버에 Google OAuth 설정이 구성되지 않았습니다.',
        });
      }

      let ticket;
      try {
        ticket = await googleOAuthClient.verifyIdToken({
          idToken,
          audience: googleClientId,
        });
      } catch (verificationError) {
        console.error('❌ [구글 로그인] 토큰 검증 실패:', verificationError);
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 Google 인증 토큰입니다.',
        });
      }

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        console.error('❌ [구글 로그인] 토큰에 이메일 정보가 없습니다.');
        return res.status(400).json({
          success: false,
          message: 'Google 계정 정보에 이메일이 포함되어 있지 않습니다.',
        });
      }

      const email = payload.email.toLowerCase();
      const picture = payload.picture || null;
      const googleSub = payload.sub;
      const displayName = payload.name?.trim();

      const userRepository = AppDataSource.getRepository(User);
      const linkedEmailRepository = AppDataSource.getRepository(LinkedEmail);

      let user = await userRepository.findOne({
        where: { email },
        withDeleted: true,
      });
      let userModified = false;

      if (!user) {
        const baseNickname =
          displayName?.replace(/\s+/g, '') || email.split('@')[0] || `google_${Date.now()}`;
        const nickname = await AuthController.generateUniqueNickname(baseNickname, userRepository);
        const randomPassword = await bcrypt.hash(`${googleSub}_${Date.now()}`, 10);

        user = userRepository.create({
          email,
          password_hash: randomPassword,
          nickname,
          profile_image_url: picture || undefined,
          delete_yn: false,
          social_provider: 'GOOGLE',
        });
        user = await userRepository.save(user);
        console.log(`✅ [구글 로그인] 신규 사용자 생성: ${email}`);
      } else if (user.delete_yn) {
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: '이미 탈퇴한 계정입니다. 복구하시겠습니까?',
          data: {
            user_id: user.user_id,
            email: user.email,
          },
        });
      } else if (user.social_provider !== 'GOOGLE') {
        user.social_provider = 'GOOGLE';
        userModified = true;
      }
      user.social_provider = 'GOOGLE';

      // LinkedEmail 레코드 동기화
      const existingLinkedEmail = await linkedEmailRepository.findOne({
        where: { email, platform: 'google' },
      });
      if (!existingLinkedEmail) {
        const linkedEmail = linkedEmailRepository.create({
          user_id: user.user_id,
          email,
          platform: 'google',
        });
        await linkedEmailRepository.save(linkedEmail);
      } else if (existingLinkedEmail.user_id !== user.user_id) {
        existingLinkedEmail.user_id = user.user_id;
        await linkedEmailRepository.save(existingLinkedEmail);
      }

      let updatedLocation: { latitude: number; longitude: number } | null = null;
      if (
        typeof latitude === 'number' &&
        !Number.isNaN(latitude) &&
        typeof longitude === 'number' &&
        !Number.isNaN(longitude)
      ) {
        user.location = {
          type: 'Point',
          coordinates: [longitude, latitude],
        } as any;
        updatedLocation = { latitude, longitude };
      }

      // location_text는 로그인 시 업데이트하지 않음
      // 사용자가 회원가입 또는 프로필 수정 시 설정한 주소를 유지해야 함

      if (userModified || updatedLocation) {
        await userRepository.save(user);
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          role: user.role ?? 0,
        },
        jwtSecret,
        { expiresIn: '24h' },
      );

      // FCM 토큰 및 디바이스 ID 저장 (선택사항)
      if (fcmToken && fcmToken !== 'fcm_token' && fcmToken.trim().length > 0) {
        console.log('📱 [구글 로그인] FCM 토큰 저장:', fcmToken.substring(0, 20) + '...');
        user.fcm_token = fcmToken.trim();
        await userRepository.save(user);
        console.log('✅ [구글 로그인] FCM 토큰이 DB에 저장되었습니다.');
      } else {
        console.log('⚠️ [구글 로그인] FCM 토큰이 유효하지 않아 저장하지 않습니다:', fcmToken);
      }
      if (deviceId) {
        console.log('📱 [구글 로그인] 디바이스 ID 수신:', deviceId);
      }

      return res.json({
        success: true,
        message: 'Google 로그인 성공',
        data: {
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            nickname: user.nickname,
            gender: user.gender,
            age_group: user.age_group,
            location_text: user.location_text,
            profile_image_url: user.profile_image_url,
            social_provider: user.social_provider || 'GOOGLE',
            role: user.role ?? 0,
          },
        },
      });
    } catch (error) {
      console.error('❌ [구글 로그인] 서버 오류:', error);
      return res.status(500).json({
        success: false,
        message: '구글 로그인 처리 중 서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 애플 로그인
   * POST /api/auth/apple
   */
  static async appleLogin(req: Request, res: Response) {
    try {
      const { identityToken, user: userStr, fcmToken, deviceId, latitude, longitude, location_text } = req.body;

      if (!identityToken) {
        return res.status(400).json({
          success: false,
          message: 'Apple Identity Token이 필요합니다.',
        });
      }

      let payload;
      try {
        // Apple Identity Token 검증
        // audience는 클라이언트 ID (Bundle ID)와 일치해야 함
        // ignoreExpiration: false (기본값)
        payload = await appleSignin.verifyIdToken(identityToken, {
          audience: process.env.APPLE_CLIENT_ID, // 환경 변수로 클라이언트 ID 설정 권장
          ignoreExpiration: false,
        });
      } catch (verificationError) {
        console.error('❌ [Apple 로그인] 토큰 검증 실패:', verificationError);
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 Apple Identity Token입니다.',
        });
      }

      if (!payload || !payload.email) {
        console.error('❌ [Apple 로그인] 토큰에 이메일 정보가 없습니다.');
        // Apple은 최초 로그인 시에만 이메일을 제공할 수도 있으나,
        // Identity Token의 sub(subject)는 고유하므로 이를 통해 식별 가능
        // 하지만 우리 시스템은 이메일 기반이므로 이메일이 필수
        // (scope에 email을 포함하면 토큰 claims에 email이 포함됨)
        return res.status(400).json({
          success: false,
          message: 'Apple 계정 정보에 이메일이 포함되어 있지 않습니다.',
        });
      }

      const email = payload.email.toLowerCase();
      const appleSub = payload.sub;

      // 클라이언트에서 전달받은 user 객체 (최초 로그인 시에만 이름 등이 포함됨)
      let fullName = null;
      if (userStr) {
        try {
          const userObj = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;
          if (userObj.name) {
            const { givenName, familyName } = userObj.name;
            if (givenName || familyName) {
              fullName = [familyName, givenName].filter(Boolean).join(' ').trim();
            }
          }
        } catch (e) {
          console.warn('⚠️ [Apple 로그인] 사용자 이름 파싱 실패:', e);
        }
      }

      const userRepository = AppDataSource.getRepository(User);
      const linkedEmailRepository = AppDataSource.getRepository(LinkedEmail);

      let user = await userRepository.findOne({
        where: { email },
        withDeleted: true,
      });
      let userModified = false;

      if (!user) {
        // 신규 사용자 생성
        const baseNickname =
          fullName?.replace(/\s+/g, '') || email.split('@')[0] || `apple_${Date.now()}`;
        const nickname = await AuthController.generateUniqueNickname(baseNickname, userRepository);
        const randomPassword = await bcrypt.hash(`${appleSub}_${Date.now()}`, 10);

        user = userRepository.create({
          email,
          password_hash: randomPassword,
          nickname,
          delete_yn: false,
          social_provider: 'APPLE',
        });
        user = await userRepository.save(user);
        console.log(`✅ [Apple 로그인] 신규 사용자 생성: ${email}`);
      } else if (user.delete_yn) {
        // 탈퇴한 계정 복구 제안
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: '이미 탈퇴한 계정입니다. 복구하시겠습니까?',
          data: {
            user_id: user.user_id,
            email: user.email,
          },
        });
      } else if (user.social_provider !== 'APPLE') {
        // 기존 계정을 Apple 로그인으로 전환 (혹은 연동)
        user.social_provider = 'APPLE';
        userModified = true;
      }
      user.social_provider = 'APPLE';

      // LinkedEmail 레코드 동기화
      const existingLinkedEmail = await linkedEmailRepository.findOne({
        where: { email, platform: 'apple' },
      });
      if (!existingLinkedEmail) {
        const linkedEmail = linkedEmailRepository.create({
          user_id: user.user_id,
          email,
          platform: 'apple',
        });
        await linkedEmailRepository.save(linkedEmail);
      } else if (existingLinkedEmail.user_id !== user.user_id) {
        existingLinkedEmail.user_id = user.user_id;
        await linkedEmailRepository.save(existingLinkedEmail);
      }

      let updatedLocation: { latitude: number; longitude: number } | null = null;
      if (
        typeof latitude === 'number' &&
        !Number.isNaN(latitude) &&
        typeof longitude === 'number' &&
        !Number.isNaN(longitude)
      ) {
        user.location = {
          type: 'Point',
          coordinates: [longitude, latitude],
        } as any;
        updatedLocation = { latitude, longitude };
      }

      if (userModified || updatedLocation) {
        await userRepository.save(user);
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          role: user.role ?? 0,
        },
        jwtSecret,
        { expiresIn: '24h' },
      );

      // FCM 토큰 저장
      if (fcmToken && fcmToken !== 'fcm_token' && fcmToken.trim().length > 0) {
        console.log('📱 [Apple 로그인] FCM 토큰 저장:', fcmToken.substring(0, 20) + '...');
        user.fcm_token = fcmToken.trim();
        await userRepository.save(user);
      }
      if (deviceId) {
        console.log('📱 [Apple 로그인] 디바이스 ID 수신:', deviceId);
      }

      return res.json({
        success: true,
        message: 'Apple 로그인 성공',
        data: {
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            nickname: user.nickname,
            gender: user.gender,
            age_group: user.age_group,
            location_text: user.location_text,
            profile_image_url: user.profile_image_url,
            social_provider: user.social_provider || 'APPLE',
            role: user.role ?? 0,
          },
        },
      });
    } catch (error) {
      console.error('❌ [Apple 로그인] 서버 오류:', error);
      return res.status(500).json({
        success: false,
        message: 'Apple 로그인 처리 중 서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 카카오 로그인
   * POST /api/auth/kakao
   */
  static async kakaoLogin(req: Request, res: Response) {
    try {
      const { accessToken, fcmToken, deviceId, latitude, longitude, location_text } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: '카카오 액세스 토큰이 필요합니다.',
        });
      }

      // 카카오 API로 사용자 정보 가져오기
      const kakaoUserInfoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!kakaoUserInfoResponse.ok) {
        console.error('❌ [카카오 로그인] 카카오 API 호출 실패:', kakaoUserInfoResponse.status);
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 카카오 인증 토큰입니다.',
        });
      }

      const kakaoUserInfo = (await kakaoUserInfoResponse.json()) as any;
      const kakaoAccount = kakaoUserInfo.kakao_account;

      if (!kakaoAccount || !kakaoAccount.email) {
        console.error('❌ [카카오 로그인] 카카오 계정 정보에 이메일이 없습니다.');
        return res.status(400).json({
          success: false,
          message: '카카오 계정 정보에 이메일이 포함되어 있지 않습니다.',
        });
      }

      const email = kakaoAccount.email.toLowerCase();
      const picture = kakaoAccount.profile?.profile_image_url || null;
      const kakaoId = String(kakaoUserInfo.id);
      const displayName = kakaoAccount.profile?.nickname?.trim() || null;

      const userRepository = AppDataSource.getRepository(User);
      const linkedEmailRepository = AppDataSource.getRepository(LinkedEmail);

      let user = await userRepository.findOne({
        where: { email },
        withDeleted: true,
      });
      let userModified = false;

      if (!user) {
        const baseNickname =
          displayName?.replace(/\s+/g, '') || email.split('@')[0] || `kakao_${Date.now()}`;
        const nickname = await AuthController.generateUniqueNickname(baseNickname, userRepository);
        const randomPassword = await bcrypt.hash(`${kakaoId}_${Date.now()}`, 10);

        user = userRepository.create({
          email,
          password_hash: randomPassword,
          nickname,
          profile_image_url: picture || undefined,
          delete_yn: false,
          social_provider: 'KAKAO',
        });
        user = await userRepository.save(user);
        console.log(`✅ [카카오 로그인] 신규 사용자 생성: ${email}`);
      } else if (user.delete_yn) {
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: '이미 탈퇴한 계정입니다. 복구하시겠습니까?',
          data: {
            user_id: user.user_id,
            email: user.email,
          },
        });
      } else if (user.social_provider !== 'KAKAO') {
        user.social_provider = 'KAKAO';
        userModified = true;
      }
      user.social_provider = 'KAKAO';

      // LinkedEmail 레코드 동기화
      const existingLinkedEmail = await linkedEmailRepository.findOne({
        where: { email, platform: 'kakao' },
      });
      if (!existingLinkedEmail) {
        const linkedEmail = linkedEmailRepository.create({
          user_id: user.user_id,
          email,
          platform: 'kakao',
        });
        await linkedEmailRepository.save(linkedEmail);
      } else if (existingLinkedEmail.user_id !== user.user_id) {
        existingLinkedEmail.user_id = user.user_id;
        await linkedEmailRepository.save(existingLinkedEmail);
      }

      let updatedLocation: { latitude: number; longitude: number } | null = null;
      if (
        typeof latitude === 'number' &&
        !Number.isNaN(latitude) &&
        typeof longitude === 'number' &&
        !Number.isNaN(longitude)
      ) {
        user.location = {
          type: 'Point',
          coordinates: [longitude, latitude],
        } as any;
        updatedLocation = { latitude, longitude };
      }

      if (userModified || updatedLocation) {
        await userRepository.save(user);
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          role: user.role ?? 0,
        },
        jwtSecret,
        { expiresIn: '24h' },
      );

      // FCM 토큰 및 디바이스 ID 저장 (선택사항)
      if (fcmToken && fcmToken !== 'fcm_token' && fcmToken.trim().length > 0) {
        console.log('📱 [카카오 로그인] FCM 토큰 저장:', fcmToken.substring(0, 20) + '...');
        user.fcm_token = fcmToken.trim();
        await userRepository.save(user);
        console.log('✅ [카카오 로그인] FCM 토큰이 DB에 저장되었습니다.');
      } else {
        console.log('⚠️ [카카오 로그인] FCM 토큰이 유효하지 않아 저장하지 않습니다:', fcmToken);
      }
      if (deviceId) {
        console.log('📱 [카카오 로그인] 디바이스 ID 수신:', deviceId);
      }

      return res.json({
        success: true,
        message: '카카오 로그인 성공',
        data: {
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            nickname: user.nickname,
            gender: user.gender,
            age_group: user.age_group,
            location_text: user.location_text,
            profile_image_url: user.profile_image_url,
            social_provider: user.social_provider || 'KAKAO',
            role: user.role ?? 0,
          },
        },
      });
    } catch (error) {
      console.error('❌ [카카오 로그인] 서버 오류:', error);
      return res.status(500).json({
        success: false,
        message: '카카오 로그인 처리 중 서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 네이버 로그인
   * POST /api/auth/naver
   */
  static async naverLogin(req: Request, res: Response) {
    try {
      const { accessToken, fcmToken, deviceId, latitude, longitude, location_text } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: '네이버 액세스 토큰이 필요합니다.',
        });
      }

      // 네이버 API로 사용자 정보 가져오기
      const naverUserInfoResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!naverUserInfoResponse.ok) {
        console.error('❌ [네이버 로그인] 네이버 API 호출 실패:', naverUserInfoResponse.status);
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 네이버 인증 토큰입니다.',
        });
      }

      const naverUserInfo = (await naverUserInfoResponse.json()) as any;
      const naverResponse = naverUserInfo.response;

      if (!naverResponse || !naverResponse.email) {
        console.error('❌ [네이버 로그인] 네이버 계정 정보에 이메일이 없습니다.');
        return res.status(400).json({
          success: false,
          message: '네이버 계정 정보에 이메일이 포함되어 있지 않습니다.',
        });
      }

      const email = naverResponse.email.toLowerCase();
      const picture = naverResponse.profile_image || null;
      const naverId = String(naverResponse.id);
      const displayName = naverResponse.name?.trim() || null;

      const userRepository = AppDataSource.getRepository(User);
      const linkedEmailRepository = AppDataSource.getRepository(LinkedEmail);

      let user = await userRepository.findOne({
        where: { email },
        withDeleted: true,
      });
      let userModified = false;

      if (!user) {
        const baseNickname =
          displayName?.replace(/\s+/g, '') || email.split('@')[0] || `naver_${Date.now()}`;
        const nickname = await AuthController.generateUniqueNickname(baseNickname, userRepository);
        const randomPassword = await bcrypt.hash(`${naverId}_${Date.now()}`, 10);

        user = userRepository.create({
          email,
          password_hash: randomPassword,
          nickname,
          profile_image_url: picture || undefined,
          delete_yn: false,
          social_provider: 'NAVER',
        });
        user = await userRepository.save(user);
        console.log(`✅ [네이버 로그인] 신규 사용자 생성: ${email}`);
      } else if (user.delete_yn) {
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: '이미 탈퇴한 계정입니다. 복구하시겠습니까?',
          data: {
            user_id: user.user_id,
            email: user.email,
          },
        });
      } else if (user.social_provider !== 'NAVER') {
        user.social_provider = 'NAVER';
        userModified = true;
      }
      user.social_provider = 'NAVER';

      // LinkedEmail 레코드 동기화
      const existingLinkedEmail = await linkedEmailRepository.findOne({
        where: { email, platform: 'naver' },
      });
      if (!existingLinkedEmail) {
        const linkedEmail = linkedEmailRepository.create({
          user_id: user.user_id,
          email,
          platform: 'naver',
        });
        await linkedEmailRepository.save(linkedEmail);
      } else if (existingLinkedEmail.user_id !== user.user_id) {
        existingLinkedEmail.user_id = user.user_id;
        await linkedEmailRepository.save(existingLinkedEmail);
      }

      let updatedLocation: { latitude: number; longitude: number } | null = null;
      if (
        typeof latitude === 'number' &&
        !Number.isNaN(latitude) &&
        typeof longitude === 'number' &&
        !Number.isNaN(longitude)
      ) {
        user.location = {
          type: 'Point',
          coordinates: [longitude, latitude],
        } as any;
        updatedLocation = { latitude, longitude };
      }

      if (userModified || updatedLocation) {
        await userRepository.save(user);
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          role: user.role ?? 0,
        },
        jwtSecret,
        { expiresIn: '24h' },
      );

      // FCM 토큰 및 디바이스 ID 저장 (선택사항)
      if (fcmToken && fcmToken !== 'fcm_token' && fcmToken.trim().length > 0) {
        console.log('📱 [네이버 로그인] FCM 토큰 저장:', fcmToken.substring(0, 20) + '...');
        user.fcm_token = fcmToken.trim();
        await userRepository.save(user);
        console.log('✅ [네이버 로그인] FCM 토큰이 DB에 저장되었습니다.');
      } else {
        console.log('⚠️ [네이버 로그인] FCM 토큰이 유효하지 않아 저장하지 않습니다:', fcmToken);
      }
      if (deviceId) {
        console.log('📱 [네이버 로그인] 디바이스 ID 수신:', deviceId);
      }

      return res.json({
        success: true,
        message: '네이버 로그인 성공',
        data: {
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            nickname: user.nickname,
            gender: user.gender,
            age_group: user.age_group,
            location_text: user.location_text,
            profile_image_url: user.profile_image_url,
            social_provider: user.social_provider || 'NAVER',
            role: user.role ?? 0,
          },
        },
      });
    } catch (error) {
      console.error('❌ [네이버 로그인] 서버 오류:', error);
      return res.status(500).json({
        success: false,
        message: '네이버 로그인 처리 중 서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 비밀번호 재설정 요청
   * POST /api/auth/password-reset-request
   */
  static async passwordResetRequest(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: '이메일을 입력해주세요.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { email, delete_yn: false },
      });

      // 보안상 존재하지 않는 사용자여도 성공 응답
      return res.json({
        success: true,
        message: '비밀번호 재설정 이메일을 발송했습니다.',
      });
    } catch (error) {
      console.error('비밀번호 재설정 요청 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 비밀번호 재설정
   * POST /api/auth/password-reset
   */
  static async passwordReset(req: Request, res: Response) {
    try {
      const { token, new_password } = req.body;

      if (!token || !new_password) {
        return res.status(400).json({
          success: false,
          message: '토큰과 새 비밀번호를 입력해주세요.',
        });
      }

      // 토큰 검증 (실제 구현에서는 Redis나 DB에 저장된 토큰과 비교)
      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';

      try {
        const decoded = jwt.verify(token, jwtSecret) as any;

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
          where: { user_id: decoded.user_id, delete_yn: false },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: '사용자를 찾을 수 없습니다.',
          });
        }

        // 새 비밀번호 해시화
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(new_password, saltRounds);

        user.password_hash = passwordHash;
        await userRepository.save(user);

        return res.json({
          success: true,
          message: '비밀번호가 성공적으로 변경되었습니다.',
        });
      } catch (jwtError) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 토큰입니다.',
        });
      }
    } catch (error) {
      console.error('비밀번호 재설정 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 사용자 프로필 조회
   * GET /api/auth/profile
   * 인증된 사용자의 프로필 정보를 반환합니다.
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: userId, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          user_id: user.user_id,
          email: user.email,
          nickname: user.nickname,
          profile_image_url: user.profile_image_url || null,
          introduction: user.introduction || null,
          location_text: user.location_text || null,
          role: user.role,
          social_provider: user.social_provider || null,
        },
      });
    } catch (error) {
      console.error('프로필 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '프로필 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 사용자 프로필 업데이트
   * PUT /api/auth/profile
   * 인증된 사용자의 프로필 정보를 업데이트합니다.
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const { nickname, introduction, gender, age_group, location_text, profile_image_url, view_mode } = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: userId, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // 닉네임 중복 확인 (nickname이 제공되고 변경되는 경우)
      if (nickname && nickname !== user.nickname) {
        const existingNickname = await userRepository.findOne({
          where: { nickname, delete_yn: false },
        });

        if (existingNickname) {
          return res.status(409).json({
            success: false,
            message: '이미 사용 중인 닉네임입니다.',
          });
        }
      }

      // 프로필 정보 업데이트
      if (nickname !== undefined) {
        user.nickname = nickname;
      }
      if (introduction !== undefined) {
        user.introduction = introduction || null;
      }
      if (gender !== undefined) {
        user.gender = gender || null;
      }
      if (age_group !== undefined) {
        user.age_group = age_group || null;
      }
      if (location_text !== undefined) {
        user.location_text = location_text || null;
      }
      if (profile_image_url !== undefined) {
        // S3 URL을 상대 경로로 변환하여 저장
        user.profile_image_url = normalizeToRelativePath(profile_image_url);
      }
      if (view_mode !== undefined) {
        user.view_mode = view_mode !== null && view_mode !== undefined ? Number(view_mode) : undefined;
      }

      await userRepository.save(user);

      return res.json({
        success: true,
        message: '프로필이 수정되었습니다.',
        data: {
          user_id: user.user_id,
          nickname: user.nickname,
          introduction: user.introduction,
          gender: user.gender,
          age_group: user.age_group,
          location_text: user.location_text,
          profile_image_url: user.profile_image_url,
          social_provider: user.social_provider || null,
          view_mode: user.view_mode || null,
        },
      });
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      return res.status(500).json({
        success: false,
        message: '프로필 업데이트 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 비밀번호 변경
   * POST /api/auth/password/change
   */
  static async changePassword(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.user_id) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const { verification_code, verificationCode, new_password, newPassword } = req.body;
      const resolvedCode = verification_code || verificationCode;
      const resolvedPassword = new_password || newPassword;

      if (!resolvedCode || !resolvedPassword) {
        return res.status(400).json({
          success: false,
          message: '인증번호와 새 비밀번호를 입력해주세요.',
        });
      }

      if (typeof resolvedPassword !== 'string' || resolvedPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 8자 이상이어야 합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { user_id: authUser.user_id, delete_yn: false },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      if (user.social_provider && user.social_provider !== 'LOCAL') {
        return res.status(400).json({
          success: false,
          message: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.',
        });
      }

      await AuthController.validateEmailCode(user.email, String(resolvedCode), 'PASSWORD_CHANGE');

      const passwordHash = await bcrypt.hash(resolvedPassword, 10);
      user.password_hash = passwordHash;
      await userRepository.save(user);

      return res.json({
        success: true,
        message: '비밀번호가 변경되었습니다.',
      });
    } catch (error) {
      console.error('❌ [비밀번호 변경] 오류:', error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || '비밀번호 변경 중 오류가 발생했습니다.',
      });
    }
  }

  private static normalizePurpose(purpose?: string): string {
    return (typeof purpose === 'string' && purpose.trim().length > 0
      ? purpose.trim()
      : 'GENERAL'
    ).toUpperCase();
  }

  private static async validateEmailCode(
    email: string,
    code: string,
    purpose: string,
    consume: boolean = true,
  ): Promise<void> {
    const verificationRepository = AppDataSource.getRepository(EmailVerification);
    const normalizedPurpose = AuthController.normalizePurpose(purpose);
    const record = await verificationRepository.findOne({
      where: { email, purpose: normalizedPurpose },
    });

    if (!record) {
      throw new Error('해당 이메일로 요청한 인증번호가 없습니다. 다시 요청해주세요.');
    }

    const now = new Date();
    if (record.expires_at.getTime() < now.getTime()) {
      await verificationRepository.delete(record.verification_id);
      throw new Error('인증번호 유효 시간이 만료되었습니다. 다시 요청해주세요.');
    }

    if (record.attempt_count >= EMAIL_CODE_MAX_ATTEMPTS) {
      await verificationRepository.delete(record.verification_id);
      throw new Error('인증 실패 횟수가 초과되었습니다. 인증번호를 다시 요청해주세요.');
    }

    if (record.code !== code.trim()) {
      record.attempt_count += 1;
      await verificationRepository.save(record);
      throw new Error('인증번호가 올바르지 않습니다.');
    }

    if (consume) {
      await verificationRepository.delete(record.verification_id);
    } else {
      record.is_verified = true;
      record.verified_at = now;
      record.attempt_count = 0;
      await verificationRepository.save(record);
    }
  }

  private static async generateUniqueNickname(baseNickname: string, userRepository: any) {
    let nickname = baseNickname || `user_${Date.now()}`;
    let suffix = 0;

    while (
      await userRepository.findOne({
        where: { nickname, delete_yn: false },
      })
    ) {
      suffix += 1;
      nickname = `${baseNickname}_${suffix}`;
    }

    return nickname;
  }
}
