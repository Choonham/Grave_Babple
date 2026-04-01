import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {Notification} from '../models/Interaction';
import {User} from '../models/User';
import {RecipePost} from '../models/Post';
import {sendPushNotification, isFirebaseInitialized} from '../services/FirebaseService';

/**
 * 알림 컨트롤러
 */
export class NotificationController {
  /**
   * 알림 목록 조회
   * GET /api/notifications
   */
  static async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const notificationRepository = AppDataSource.getRepository(Notification);

      const notifications = await notificationRepository.find({
        where: {recipient_id: userId},
        relations: ['actor'],
        order: {created_at: 'DESC'},
        take: 100, // 최대 100개
      });

      // 날짜별로 그룹화
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const formattedNotifications = notifications.map(noti => {
        const createdAt = new Date(noti.created_at);
        let section: '오늘' | '어제' | '이전' = '이전';

        if (createdAt >= today) {
          section = '오늘';
        } else if (createdAt >= yesterday) {
          section = '어제';
        }

        // 시간 포맷팅 (오후 2:30 형식)
        const hours = createdAt.getHours();
        const minutes = createdAt.getMinutes();
        const ampm = hours >= 12 ? '오후' : '오전';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        const time = `${ampm} ${displayHours}:${minutes.toString().padStart(2, '0')}`;

        // 알림 메시지 생성
        const actorName = noti.actor?.nickname || '이웃';
        let title = '';

        switch (noti.action_type) {
          case 'NEW_LIKE':
            title = `${actorName}님이 당신의 레시피를 칭찬했어요!`;
            break;
          case 'NEW_COMMENT':
            title = `${actorName}님이 당신의 레시피에 댓글을 남겼어요!`;
            break;
          case 'NEW_FOLLOW':
            title = `${actorName}님이 당신을 팔로잉으로 등록했어요!`;
            break;
          default:
            title = '새로운 알림이 있습니다.';
        }

        return {
          notification_id: noti.notification_id,
          type: noti.action_type === 'NEW_LIKE' ? 'like' : noti.action_type === 'NEW_COMMENT' ? 'comment' : 'follow',
          title,
          time,
          section,
          is_read: noti.is_read,
          target_id: noti.target_id,
          actor: noti.actor ? {
            user_id: noti.actor.user_id,
            nickname: noti.actor.nickname,
            profile_image_url: noti.actor.profile_image_url,
          } : null,
        };
      });

      return res.json({
        success: true,
        data: formattedNotifications,
      });
    } catch (error) {
      console.error('알림 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '알림 목록을 불러오는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 읽지 않은 알림 개수 조회
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const notificationRepository = AppDataSource.getRepository(Notification);

      const count = await notificationRepository.count({
        where: {
          recipient_id: userId,
          is_read: false,
        },
      });

      return res.json({
        success: true,
        data: {count},
      });
    } catch (error) {
      console.error('읽지 않은 알림 개수 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '읽지 않은 알림 개수를 불러오는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 알림 읽음 처리
   * PUT /api/notifications/:notificationId/read
   */
  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {notificationId} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const notificationRepository = AppDataSource.getRepository(Notification);

      const notification = await notificationRepository.findOne({
        where: {
          notification_id: notificationId,
          recipient_id: userId,
        },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: '알림을 찾을 수 없습니다.',
        });
      }

      notification.is_read = true;
      await notificationRepository.save(notification);

      return res.json({
        success: true,
        message: '알림이 읽음 처리되었습니다.',
      });
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      return res.status(500).json({
        success: false,
        message: '알림 읽음 처리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 모든 알림 읽음 처리
   * PUT /api/notifications/read-all
   */
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const notificationRepository = AppDataSource.getRepository(Notification);

      await notificationRepository.update(
        {
          recipient_id: userId,
          is_read: false,
        },
        {
          is_read: true,
        },
      );

      return res.json({
        success: true,
        message: '모든 알림이 읽음 처리되었습니다.',
      });
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
      return res.status(500).json({
        success: false,
        message: '알림 읽음 처리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 알림 생성 헬퍼 함수
   * (다른 컨트롤러에서 사용)
   */
  static async createNotification(
    recipientId: string,
    actorId: string,
    actionType: 'NEW_LIKE' | 'NEW_COMMENT' | 'NEW_FOLLOW',
    targetId?: string,
  ) {
    try {
      // 자기 자신에게는 알림을 생성하지 않음
      if (recipientId === actorId) {
        return;
      }

      const notificationRepository = AppDataSource.getRepository(Notification);

      const notification = notificationRepository.create({
        recipient_id: recipientId,
        actor_id: actorId,
        action_type: actionType,
        target_id: targetId,
        is_read: false,
      });

      await notificationRepository.save(notification);

      // 푸시 알림 전송
      try {
        const recipient = await AppDataSource.getRepository(User).findOne({
          where: {user_id: recipientId},
          select: ['user_id', 'fcm_token', 'is_push_notification_enabled'],
        });

        const actor = await AppDataSource.getRepository(User).findOne({
          where: {user_id: actorId},
          select: ['user_id', 'nickname'],
        });

        if (
          recipient &&
          recipient.fcm_token &&
          recipient.is_push_notification_enabled &&
          isFirebaseInitialized()
        ) {
          const actorName = actor?.nickname || '이웃';
          let title = '';
          let body = '';

          switch (actionType) {
            case 'NEW_LIKE':
              title = `${actorName}님이 당신의 레시피를 칭찬했어요!`;
              body = '새로운 칭찬을 확인해보세요.';
              break;
            case 'NEW_COMMENT':
              title = `${actorName}님이 당신의 레시피에 댓글을 남겼어요!`;
              body = '새로운 댓글을 확인해보세요.';
              break;
            case 'NEW_FOLLOW':
              title = `${actorName}님이 당신을 팔로잉으로 등록했어요!`;
              body = '새로운 팔로잉을 확인해보세요.';
              break;
            default:
              title = '새로운 알림이 있습니다.';
              body = '알림을 확인해보세요.';
          }

          await sendPushNotification(recipient.fcm_token, {
            title,
            body,
            data: {
              type: 'notification',
              notificationId: notification.notification_id,
              actionType: actionType,
              targetId: targetId,
              actorId: actorId,
            },
          });

          console.log(`📱 [Push] 푸시 알림 전송: recipient=${recipientId}, actionType=${actionType}`);
        }
      } catch (pushError) {
        console.error('푸시 알림 전송 오류:', pushError);
        // 푸시 알림 실패는 알림 생성을 막지 않음
      }

      console.log(`✅ [NotificationController] 알림 생성 완료: ${actionType} - recipient: ${recipientId}, actor: ${actorId}`);
    } catch (error) {
      console.error('❌ [NotificationController] 알림 생성 오류:', error);
      // 알림 생성 실패해도 메인 로직은 계속 진행
    }
  }
}

