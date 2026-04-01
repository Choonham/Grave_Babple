import {Request, Response, NextFunction} from 'express';
import {normalizeImageUrlsInObject} from '../utils/imageUrl';

/**
 * 응답의 모든 이미지 URL을 S3 URL로 변환하는 미들웨어
 */
export function normalizeImageUrlsMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    // 응답 데이터의 모든 이미지 URL 변환
    const normalizedData = normalizeImageUrlsInObject(data);
    
    // 디버깅: 변환 전후 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [응답 미들웨어] 이미지 URL 변환 완료');
    }
    
    return originalJson(normalizedData);
  };

  next();
}

