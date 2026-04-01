import messaging from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {UserAPI} from '../api/ApiRequests';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Firebase 푸시 알림 서비스
 */
class FirebaseService {
  private fcmToken: string | null = null;
  private notificationHandlers: Map<string, (data: any) => void> = new Map();
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Firebase 초기화 및 FCM 토큰 등록
   */
  async initialize(): Promise<void> {
    // 이미 초기화 중이면 기다림
    if (this.isInitializing && this.initializationPromise) {
      console.log('🔥 [Firebase] 이미 초기화 중입니다. 대기...');
      return this.initializationPromise;
    }

    // 이미 토큰이 있으면 초기화 스킵
    if (this.fcmToken) {
      console.log('🔥 [Firebase] 이미 초기화되어 있습니다.');
      return;
    }

    this.isInitializing = true;
    this.initializationPromise = this._doInitialize();
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 실제 초기화 로직
   */
  private async _doInitialize(): Promise<void> {
    try {
      console.log('🔥 [Firebase] 초기화 시작...');

      // 알림 권한 요청
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.warn('⚠️ [Firebase] 알림 권한이 거부되었습니다.');
          return;
        }
      } else if (Platform.OS === 'android') {
        // Android 13 (API 33) 이상에서 알림 권한 요청
        if (Platform.Version >= 33) {
          try {
            // PERMISSIONS가 제대로 로드되었는지 확인
            if (PERMISSIONS && PERMISSIONS.ANDROID && PERMISSIONS.ANDROID.POST_NOTIFICATIONS) {
              const notificationPermission = PERMISSIONS.ANDROID.POST_NOTIFICATIONS;
              const permissionStatus = await check(notificationPermission);
              console.log('🔔 [Firebase] Android 알림 권한 상태:', permissionStatus);

              if (permissionStatus !== RESULTS.GRANTED) {
                if (permissionStatus === RESULTS.DENIED || permissionStatus === RESULTS.UNAVAILABLE) {
                  const requestResult = await request(notificationPermission);
                  console.log('🔔 [Firebase] Android 알림 권한 요청 결과:', requestResult);
                  
                  if (requestResult !== RESULTS.GRANTED) {
                    console.warn('⚠️ [Firebase] Android 알림 권한이 거부되었습니다.');
                    // 권한이 거부되어도 FCM 토큰은 가져올 수 있지만, 알림은 표시되지 않을 수 있음
                  }
                } else if (permissionStatus === RESULTS.BLOCKED) {
                  console.warn('⚠️ [Firebase] Android 알림 권한이 차단되었습니다. 설정에서 권한을 허용해주세요.');
                  // 권한이 차단되어도 FCM 토큰은 가져올 수 있지만, 알림은 표시되지 않음
                }
              }
            } else {
              console.warn('⚠️ [Firebase] POST_NOTIFICATIONS 권한을 찾을 수 없습니다. 권한 체크를 건너뜁니다.');
              // 권한 체크 실패해도 FCM 토큰은 가져올 수 있음
            }
          } catch (permissionError: any) {
            console.error('❌ [Firebase] 알림 권한 체크 중 오류:', permissionError);
            console.warn('⚠️ [Firebase] 권한 체크 실패했지만 FCM 토큰 가져오기는 계속 진행합니다.');
            // 권한 체크 실패해도 FCM 토큰은 가져올 수 있음
          }
        } else {
          // Android 12 이하는 알림 권한이 자동으로 허용됨
          console.log('✅ [Firebase] Android 12 이하에서는 알림 권한이 자동으로 허용됩니다.');
        }
      }

      // FCM 토큰 가져오기
      try {
        const token = await messaging().getToken();
        if (token) {
          this.fcmToken = token;
          console.log('📱 [Firebase] FCM Token 획득 성공');
          console.log('📱 [Firebase] FCM Token (처음 20자):', token.substring(0, 20) + '...');

          // 서버에 FCM 토큰 등록
          await this.registerFcmToken(token);
        } else {
          console.warn('⚠️ [Firebase] FCM 토큰을 가져올 수 없습니다.');
        }
      } catch (tokenError: any) {
        console.error('❌ [Firebase] FCM 토큰 가져오기 실패:', tokenError);
        console.error('❌ [Firebase] 에러 메시지:', tokenError.message);
        console.error('❌ [Firebase] 에러 코드:', tokenError.code);
      }

      // 토큰 갱신 리스너
      messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 [Firebase] FCM 토큰 갱신:', newToken);
        this.fcmToken = newToken;
        await this.registerFcmToken(newToken);
      });

      // 포그라운드 알림 리스너
      this.setupForegroundNotificationHandler();

      // 백그라운드 알림 리스너는 index.js에서 설정됨

      // 알림 클릭 리스너 (앱이 종료된 상태에서 알림 클릭)
      messaging().onNotificationOpenedApp((remoteMessage) => {
        console.log('📱 [Firebase] 알림 클릭 (앱이 백그라운드):', remoteMessage);
        this.handleNotificationClick(remoteMessage);
      });

      // 앱이 종료된 상태에서 알림 클릭으로 앱이 열린 경우
      messaging()
        .getInitialNotification()
        .then((remoteMessage) => {
          if (remoteMessage) {
            console.log('📱 [Firebase] 알림 클릭 (앱이 종료됨):', remoteMessage);
            this.handleNotificationClick(remoteMessage);
          }
        });

      console.log('✅ [Firebase] 초기화 완료');
    } catch (error) {
      console.error('❌ [Firebase] 초기화 실패:', error);
    }
  }

  /**
   * FCM 토큰을 서버에 등록
   */
  async registerFcmToken(token: string): Promise<void> {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        console.warn('⚠️ [Firebase] 로그인되지 않아 FCM 토큰을 등록할 수 없습니다.');
        // 로그인 전이면 나중에 등록하도록 저장
        await AsyncStorage.setItem('pendingFcmToken', token);
        return;
      }

      const response = await UserAPI.updateFcmToken(token);
      if (response.success) {
        console.log('✅ [Firebase] FCM 토큰이 서버에 등록되었습니다.');
        // 등록 성공 시 pending 토큰 제거
        await AsyncStorage.removeItem('pendingFcmToken');
      } else {
        console.error('❌ [Firebase] FCM 토큰 등록 실패:', response.message);
      }
    } catch (error) {
      console.error('❌ [Firebase] FCM 토큰 등록 오류:', error);
    }
  }

  /**
   * 로그인 후 대기 중인 FCM 토큰 등록
   */
  async registerPendingFcmToken(): Promise<void> {
    try {
      const pendingToken = await AsyncStorage.getItem('pendingFcmToken');
      if (pendingToken) {
        console.log('📱 [Firebase] 대기 중인 FCM 토큰 발견, 등록 시도...');
        await this.registerFcmToken(pendingToken);
      }
    } catch (error) {
      console.error('❌ [Firebase] 대기 중인 FCM 토큰 등록 오류:', error);
    }
  }

  /**
   * 포그라운드 알림 핸들러 설정
   */
  private setupForegroundNotificationHandler(): void {
    messaging().onMessage(async (remoteMessage) => {
      console.log('📱 [Firebase] 포그라운드 알림 수신:', remoteMessage);

      // 포그라운드에서는 로컬 알림으로 표시 (선택사항)
      // 또는 인앱 알림으로 표시
      if (remoteMessage.notification || remoteMessage.data) {
        // 알림 핸들러 호출
        const notificationType = remoteMessage.data?.type;
        if (notificationType && this.notificationHandlers.has(notificationType)) {
          const handler = this.notificationHandlers.get(notificationType);
          if (handler) {
            // data에 notification body도 포함 (백엔드에서 보내지 않은 경우 대비)
            const handlerData = {
              ...remoteMessage.data,
              message: remoteMessage.data?.message || remoteMessage.notification?.body || '새 메시지',
            };
            handler(handlerData);
          }
        }
      }
    });
  }


  /**
   * 알림 클릭 처리
   */
  private handleNotificationClick(remoteMessage: any): void {
    const data = remoteMessage.data;
    if (!data || !data.type) {
      return;
    }

    const notificationType = data.type;
    if (this.notificationHandlers.has(notificationType)) {
      const handler = this.notificationHandlers.get(notificationType);
      if (handler) {
        handler(data);
      }
    }
  }

  /**
   * 알림 핸들러 등록
   */
  registerNotificationHandler(
    type: 'chat' | 'notification' | 'other',
    handler: (data: any) => void,
  ): void {
    this.notificationHandlers.set(type, handler);
    console.log(`✅ [Firebase] 알림 핸들러 등록: ${type}`);
  }

  /**
   * 알림 핸들러 제거
   */
  unregisterNotificationHandler(type: 'chat' | 'notification' | 'other'): void {
    this.notificationHandlers.delete(type);
    console.log(`✅ [Firebase] 알림 핸들러 제거: ${type}`);
  }

  /**
   * FCM 토큰 삭제 (로그아웃 시)
   */
  async deleteFcmToken(): Promise<void> {
    try {
      const response = await UserAPI.deleteFcmToken();
      if (response.success) {
        console.log('✅ [Firebase] FCM 토큰이 서버에서 삭제되었습니다.');
        this.fcmToken = null;
      } else {
        console.error('❌ [Firebase] FCM 토큰 삭제 실패:', response.message);
      }
    } catch (error) {
      console.error('❌ [Firebase] FCM 토큰 삭제 오류:', error);
    }
  }

  /**
   * 현재 FCM 토큰 가져오기
   */
  getFcmToken(): string | null {
    return this.fcmToken;
  }

  /**
   * FCM 토큰을 가져올 때까지 기다림 (최대 5초)
   */
  async waitForToken(maxWaitMs: number = 5000): Promise<string | null> {
    const startTime = Date.now();
    
    // 이미 토큰이 있으면 바로 반환
    if (this.fcmToken) {
      return this.fcmToken;
    }

    // 초기화가 진행 중이면 기다림
    if (this.isInitializing && this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch (error) {
        console.error('❌ [Firebase] 초기화 대기 중 오류:', error);
      }
    }

    // 토큰이 있으면 반환
    if (this.fcmToken) {
      return this.fcmToken;
    }

    // 초기화가 안 되어 있으면 초기화 시도
    if (!this.isInitializing) {
      try {
        await this.initialize();
      } catch (error) {
        console.error('❌ [Firebase] 토큰 대기 중 초기화 실패:', error);
      }
    }

    // 토큰이 있을 때까지 대기 (최대 maxWaitMs)
    while (!this.fcmToken && (Date.now() - startTime) < maxWaitMs) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
    }

    return this.fcmToken;
  }
}

// 싱글톤 인스턴스
export const firebaseService = new FirebaseService();
export default firebaseService;

