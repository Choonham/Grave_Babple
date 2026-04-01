import {Socket} from 'socket.io';
import jwt from 'jsonwebtoken';
import {ExtendedError} from 'socket.io/dist/namespace';

/**
 * Socket.io JWT 인증 미들웨어
 */
export const authenticateSocket = async (
  socket: Socket,
  next: (err?: ExtendedError) => void,
) => {
  try {
    // Socket.io에서 토큰은 handshake.auth 또는 handshake.headers에서 가져올 수 있음
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization &&
        socket.handshake.headers.authorization.split(' ')[1]); // Bearer TOKEN

    if (!token) {
      return next(new Error('Authentication token is required'));
    }

    // JWT 토큰 검증
    const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Socket 객체에 사용자 정보 추가
    (socket as any).user = {
      user_id: decoded.user_id,
      email: decoded.email,
      nickname: decoded.nickname,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error('Socket 인증 오류:', error);
    next(new Error('Authentication failed'));
  }
};

