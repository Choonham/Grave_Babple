import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Firebase Admin SDK 초기화
 */
let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized) {
    console.log('✅ [Firebase] 이미 초기화되어 있습니다.');
    return;
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔥 [Firebase] 초기화 시작...');
    }
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
    // 상대 경로인 경우 현재 작업 디렉토리 기준으로 해석
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);

    if (process.env.NODE_ENV === 'development') {
      console.log(`📁 [Firebase] 서비스 계정 파일 경로: ${absolutePath}`);
      console.log(`📁 [Firebase] 현재 작업 디렉토리: ${process.cwd()}`);
    }

    if (!fs.existsSync(absolutePath)) {
      console.warn('⚠️ [Firebase] 서비스 계정 파일을 찾을 수 없습니다:', absolutePath);
      console.warn('⚠️ [Firebase] 푸시 알림 기능이 비활성화됩니다.');
      console.warn('⚠️ [Firebase] FIREBASE_SERVICE_ACCOUNT_PATH 환경 변수를 확인하세요.');
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [Firebase] 서비스 계정 파일 발견');
    }
    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [Firebase] 서비스 계정 파싱 완료, project_id: ${serviceAccount.project_id || 'N/A'}`);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log('✅ [Firebase] Admin SDK 초기화 완료');
  } catch (error: any) {
    console.error('❌ [Firebase] 초기화 실패:', error);
    console.error('❌ [Firebase] 에러 메시지:', error.message);
    if (error.stack) {
      console.error('❌ [Firebase] 에러 스택:', error.stack);
    }
    console.warn('⚠️ [Firebase] 푸시 알림 기능이 비활성화됩니다.');
  }
};

/**
 * 푸시 알림 전송
 */
export interface PushNotificationData {
  title: string;
  body: string;
  data?: {
    type: 'chat' | 'notification' | 'other';
    roomId?: string;
    notificationId?: string;
    targetId?: string;
    [key: string]: any;
  };
}

export const sendPushNotification = async (
  fcmToken: string,
  notification: PushNotificationData,
): Promise<boolean> => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`📱 [Firebase] sendPushNotification 호출:`, {
      has_fcm_token: !!fcmToken,
      fcm_token_preview: fcmToken ? fcmToken.substring(0, 20) + '...' : null,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      firebase_initialized: firebaseInitialized,
    });
  }

  if (!firebaseInitialized) {
    console.warn('⚠️ [Firebase] Firebase가 초기화되지 않았습니다. 푸시 알림을 전송할 수 없습니다.');
    return false;
  }

  if (!fcmToken) {
    console.warn('⚠️ [Firebase] FCM 토큰이 없습니다.');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data
        ? Object.entries(notification.data).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {} as Record<string, string>)
        : undefined,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'babple_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 [Firebase] FCM 메시지 전송 시도:`, {
        token_preview: fcmToken.substring(0, 20) + '...',
        title: message.notification?.title,
        body: message.notification?.body,
        data_keys: message.data ? Object.keys(message.data) : [],
      });
    }

    const response = await admin.messaging().send(message);
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [Firebase] 푸시 알림 전송 성공:', response);
    }
    return true;
  } catch (error: any) {
    console.error('❌ [Firebase] 푸시 알림 전송 실패:', error);
    console.error('❌ [Firebase] 에러 코드:', error.code);
    console.error('❌ [Firebase] 에러 메시지:', error.message);
    if (error.stack) {
      console.error('❌ [Firebase] 에러 스택:', error.stack);
    }

    // 유효하지 않은 토큰인 경우 (앱 삭제, 토큰 만료 등)
    if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
      console.warn('⚠️ [Firebase] 유효하지 않은 FCM 토큰입니다. 토큰을 삭제해야 합니다.');
      // 여기서는 로그만 남기고, 호출하는 쪽에서 토큰 삭제 처리
    }

    return false;
  }
};

/**
 * 여러 사용자에게 푸시 알림 전송
 */
export const sendPushNotificationToMultiple = async (
  fcmTokens: string[],
  notification: PushNotificationData,
): Promise<{ success: number; failed: number }> => {
  if (!firebaseInitialized) {
    console.warn('⚠️ [Firebase] Firebase가 초기화되지 않았습니다.');
    return { success: 0, failed: fcmTokens.length };
  }

  if (fcmTokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  const validTokens = fcmTokens.filter(token => token && token.trim().length > 0);

  if (validTokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: validTokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data
        ? Object.entries(notification.data).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {} as Record<string, string>)
        : undefined,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'babple_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [Firebase] 푸시 알림 전송 완료: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
    }

    return {
      success: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('❌ [Firebase] 푸시 알림 전송 실패:', error);
    return { success: 0, failed: validTokens.length };
  }
};

/**
 * Firebase 초기화 여부 확인
 */
export const isFirebaseInitialized = (): boolean => {
  return firebaseInitialized;
};

