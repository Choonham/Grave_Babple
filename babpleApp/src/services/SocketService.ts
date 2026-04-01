import {io, Socket} from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';

/**
 * Socket.io 클라이언트 서비스
 */
class SocketService {
  private socket: Socket | null = null;
  private socketURL: string;

  constructor() {
    // Socket.io 서버 URL (API 서버와 동일한 호스트)
    // Socket.io는 /socket.io 경로를 사용하므로 API_BASE_URL 사용
    this.socketURL = API_BASE_URL;
  }

  /**
   * Socket 연결
   */
  async connect(): Promise<Socket> {
    if (this.socket?.connected) {
      return this.socket;
    }

    try {
      const token = await AsyncStorage.getItem('accessToken');

      if (!token) {
        throw new Error('토큰이 없습니다. 로그인이 필요합니다.');
      }

      // Socket.io 클라이언트 생성
      this.socket = io(this.socketURL, {
        transports: ['websocket', 'polling'],
        auth: {
          token,
        },
        extraHeaders: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      // 연결 이벤트
      this.socket.on('connect', () => {
        console.log('✅ [Socket] 연결 성공:', this.socket?.id);
      });

      this.socket.on('connect_error', error => {
        console.error('❌ [Socket] 연결 오류:', error);
      });

      this.socket.on('disconnect', reason => {
        console.log('❌ [Socket] 연결 해제:', reason);
      });

      return this.socket;
    } catch (error) {
      console.error('❌ [Socket] 연결 실패:', error);
      throw error;
    }
  }

  /**
   * Socket 연결 해제
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('✅ [Socket] 연결 해제 완료');
    }
  }

  /**
   * Socket 인스턴스 반환
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// 싱글톤 인스턴스
export const socketService = new SocketService();
export default socketService;

