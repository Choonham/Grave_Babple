import {Request, Response, NextFunction} from 'express';
import jwt from 'jsonwebtoken';

/**
 * JWT 토큰 검증 미들웨어
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: '액세스 토큰이 필요합니다.',
      });
      return;
    }

    // JWT 토큰 검증
    const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // 요청 객체에 사용자 정보 추가 (임시)
    (req as any).user = {
      user_id: decoded.user_id,
      email: decoded.email,
      nickname: decoded.nickname,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(403).json({
      success: false,
      message: '유효하지 않은 토큰입니다.',
    });
    return;
  }
};

/**
 * 역할별 접근 제어 미들웨어
 */
export const requireRole = (roles: (string | number)[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
      });
      return;
    }

    // role이 문자열 또는 숫자일 수 있으므로 타입 변환 후 비교
    const userRole = typeof user.role === 'string' ? parseInt(user.role, 10) : user.role;
    const normalizedRoles = roles.map(r => typeof r === 'string' ? parseInt(r, 10) : r);
    
    // 숫자로 변환된 role이 normalizedRoles에 있는지 확인
    if (!normalizedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다.',
      });
      return;
    }

    next();
  };
};

/**
 * 소유자 확인 미들웨어 (본인 소유 리소스만 접근)
 */
export const requireOwnership = (resourceUserIdField: string = 'user_id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
      });
      return;
    }

    if (user.user_id !== resourceUserId) {
      res.status(403).json({
        success: false,
        message: '본인의 리소스만 접근할 수 있습니다.',
      });
      return;
    }

    next();
  };
};

/**
 * 역할별 미들웨어 팩토리
 */
export const requireStoreOwner = requireRole([1]); // role 1: store owner
export const requireAdvertiser = requireRole([2]); // role 2: advertiser
export const requireAdmin = requireRole([9]); // role 9: admin