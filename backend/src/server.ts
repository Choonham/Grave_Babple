// Sentry는 가장 먼저 초기화되어야 합니다
import { initializeSentry } from './config/sentry';
import * as Sentry from '@sentry/node';

initializeSentry();

import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

import { initializeDatabase, closeDatabase } from './config/database';
import { uploadDir } from './config/upload';
import apiRoutes from './routes/api';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setupChatSocket } from './socket/chatSocket';
import { initializeFirebase } from './services/FirebaseService';

/**
 * Express 애플리케이션 생성
 */
const app = express();

/**
 * HTTP 서버 생성 (Socket.io를 위해 필요)
 */
let httpServer: HTTPServer | null = null;
let io: SocketIOServer | null = null;

/**
 * 서버 시작 확인 로그
 */
console.log('✅ [서버 초기화] server.ts 파일이 로드되었습니다.');
console.log('✅ [서버 초기화] 현재 시간:', new Date().toISOString());

/**
 * Firebase 초기화
 */
initializeFirebase();

/**
 * CORS 설정 (가장 먼저 설정, helmet보다 먼저)
 */
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://babplealpha.slowflowsoft.com', 'https://babplealpha.slowflowsoft.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081', 'http://10.0.2.2:3000', 'http://10.0.2.2:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

/**
 * Sentry 요청 핸들러 (반드시 첫 번째 미들웨어로 설정)
 * Sentry가 모든 요청을 추적할 수 있도록 설정
 */
app.use((req, res, next) => {
  // Sentry에 요청 컨텍스트 추가
  Sentry.setContext('request', {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });
  next();
});

/**
 * 모든 요청 로깅
 */
app.use((req, res, next) => {
  // AI 분석 요청은 데이터가 너무 크므로 로그 축소
  const isAIAnalyze = req.url?.includes('ai-analyze');

  if (process.env.NODE_ENV === 'development') {
    console.log('🔵 [모든 요청]', req.method, req.url);
    if (!isAIAnalyze) {
      console.log('🔵 [모든 요청] Body (raw):', req.body);
    } else {
      console.log('🔵 [모든 요청] AI 분석 요청 (데이터 크기 축소 로그)');
    }
  }
  next();
});

/**
 * 보안 미들웨어 설정
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

/**
 * 압축 미들웨어
 */
app.use(compression());

/**
 * 로깅 미들웨어
 */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/**
 * 요청 제한 미들웨어
 * ⚠️ Rate Limit 비활성화 (Artillery 부하 테스트용)
 * 프로덕션 환경에서는 반드시 활성화 필요!
 */
// const limiter = rateLimit({
//   windowMs: 60 * 1000, // 1분
//   max: 500, // 최대 500 요청 (1분당)
//   message: {
//     success: false,
//     message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => {
//     // 헬스 체크는 제한 제외
//     return req.path === '/health';
//   },
// });

// app.use('/api/', limiter); // ⚠️ 비활성화됨

// 이미지 URL 변환 미들웨어 (모든 API 응답의 이미지 URL을 S3 URL로 변환)
import { normalizeImageUrlsMiddleware } from './middleware/imageUrl';
app.use('/api', normalizeImageUrlsMiddleware);

/**
 * JSON 파싱 미들웨어
 */
app.use(express.json({
  limit: '100mb', // 레시피 이미지 업로드를 위해 100MB로 증가
  strict: false, // JSON 파싱을 더 관대하게
}));

app.use(express.urlencoded({ extended: true, limit: '100mb' }));
// Multer가 multipart/form-data 파일 업로드를 직접 처리하므로
// body parser는 JSON/URL-encoded 요청만 처리합니다.

/**
 * 정적 파일 서빙
 * S3 사용으로 인해 로컬 정적 파일 서빙 불필요
 * 모든 파일은 S3에서 직접 서빙됨
 */
// app.use('/uploads', express.static(uploadDir));
console.log(`📁 [서버 초기화] 정적 파일 서빙 비활성화 (S3 사용)`);

// 약관 정적 파일 서빙
// S3 사용으로 인해 로컬 정적 파일 서빙 불필요
// 모든 약관 파일은 S3에서 직접 읽어옴
// let backendRoot = path.dirname(__dirname); // dist 또는 src 제거 -> backend
// const termsDir = path.join(backendRoot, 'docs', 'terms');
// if (fs.existsSync(termsDir)) {
//   app.use('/docs/terms', express.static(termsDir));
//   console.log(`📁 [서버 초기화] 약관 정적 파일 서빙 설정: ${termsDir} -> /docs/terms`);
// } else {
//   console.warn(`⚠️ [서버 초기화] 약관 디렉토리를 찾을 수 없음: ${termsDir}`);
// }
console.log(`📁 [서버 초기화] 약관 파일 서빙 비활성화 (S3 사용)`);

/**
 * 헬스 체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Babple API 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * API 라우트 마운트
 */
app.use('/api', (req, res, next) => {
  // AI 분석 요청은 데이터가 너무 크므로 로그 축소
  const isAIAnalyze = req.path?.includes('ai-analyze');

  if (process.env.NODE_ENV === 'development') {
    console.log(`🌐 [서버] API 요청: ${req.method} ${req.path}`);
    if (!isAIAnalyze) {
      console.log(`🌐 [서버] Body 파싱 후:`, JSON.stringify(req.body, null, 2));
    } else {
      console.log(`🌐 [서버] AI 분석 요청 (데이터 크기 축소 로그)`);
    }
  }
  next();
}, apiRoutes);

/**
 * Sentry 에러 핸들러 (404 및 전역 에러 핸들러 전에 추가)
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Sentry에 에러 전송
  Sentry.captureException(err);
  next(err);
});

/**
 * 404 에러 핸들러
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 리소스를 찾을 수 없습니다.',
    path: req.originalUrl,
  });
});

/**
 * 전역 에러 핸들러
 */
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [전역 에러 핸들러] 오류 발생');
  console.error('❌ [전역 에러 핸들러] 오류 타입:', error.constructor?.name);
  console.error('❌ [전역 에러 핸들러] 오류 메시지:', error.message);
  console.error('❌ [전역 에러 핸들러] 오류 스택:', error.stack);
  console.error('❌ [전역 에러 핸들러] 요청 URL:', req.url);
  console.error('❌ [전역 에러 핸들러] 요청 메서드:', req.method);
  console.error('❌ [전역 에러 핸들러] 요청 Body:', req.body);

  // Payload Too Large (413) 에러 처리
  if (error.status === 413 || error.statusCode === 413 || error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: '업로드하려는 파일의 용량이 너무 큽니다. 최대 100MB까지 업로드 가능합니다. 이미지 압축을 시도해보세요.',
    });
  }

  // JSON 파싱 오류 처리
  if (error instanceof SyntaxError && 'body' in error) {
    console.error('❌ [JSON 파싱 오류] Content-Type:', req.headers['content-type']);
    return res.status(400).json({
      success: false,
      message: 'JSON 형식이 올바르지 않습니다.',
      error: error.message,
    });
  }

  // TypeORM 에러 처리
  if (error.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      success: false,
      message: '이미 존재하는 데이터입니다.',
    });
  }

  if (error.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      success: false,
      message: '관련된 데이터가 존재하지 않습니다.',
    });
  }

  // 기본 에러 응답
  return res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? '서버 오류가 발생했습니다.'
      : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

/**
 * 서버 시작 함수
 */
const startServer = async (): Promise<void> => {
  try {
    // 데이터베이스 연결 초기화
    await initializeDatabase();

    // 서버 포트 설정
    const PORT = process.env.PORT || 3000;

    // HTTP 서버 생성
    httpServer = new HTTPServer(app);

    // AI 분석 요청은 시간이 오래 걸리므로 서버 타임아웃을 60초로 설정
    httpServer.timeout = 60000; // 60초
    httpServer.keepAliveTimeout = 60000; // 60초
    httpServer.headersTimeout = 61000; // 61초 (keepAliveTimeout보다 약간 크게)

    // Socket.io 서버 생성
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // React Native에서 연결하기 위해 모든 origin 허용
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true, // 이전 버전 호환성
    });

    // 채팅 Socket 설정
    setupChatSocket(io);
    console.log('✅ [Socket.io] 채팅 Socket 서버 초기화 완료');

    // HTTP 서버 시작
    httpServer.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Babple API 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`📊 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 헬스 체크: http://localhost:${PORT}/health`);
      console.log(`🔌 Socket.io 서버 실행 중`);
      console.log(`⏰ 서버 시작 시간: ${new Date().toISOString()}`);
      console.log('='.repeat(50));
    });

    const server = httpServer;

    // Graceful shutdown 처리
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} 신호를 받았습니다. 서버를 종료합니다...`);

      // Socket.io 서버 종료
      if (io) {
        io.close(() => {
          console.log('Socket.io 서버가 종료되었습니다.');
        });
      }

      server.close(async () => {
        console.log('HTTP 서버가 종료되었습니다.');

        try {
          await closeDatabase();
          console.log('데이터베이스 연결이 종료되었습니다.');
          process.exit(0);
        } catch (error) {
          console.error('데이터베이스 종료 중 오류:', error);
          process.exit(1);
        }
      });
    };

    // 종료 신호 처리
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('서버 시작 중 오류가 발생했습니다:', error);
    process.exit(1);
  }
};

// 서버 시작
if (require.main === module) {
  startServer();
}

export default app;
