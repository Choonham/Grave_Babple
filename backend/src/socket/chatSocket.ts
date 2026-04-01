import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { ChatRoom, ChatParticipant, ChatMessage } from '../models/Chat';
import { User } from '../models/User';
import { sendPushNotification, isFirebaseInitialized } from '../services/FirebaseService';

/**
 * Socket.io를 사용하여 사용자를 room_id에 매핑
 */
const userRoomMap = new Map<string, string>(); // userId -> roomId

/**
 * 채팅 Socket 이벤트 핸들러 설정
 */
export const setupChatSocket = (io: SocketIOServer) => {
  // 인증 미들웨어 적용
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization &&
          socket.handshake.headers.authorization.split(' ')[1]);

      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const decoded = jwt.verify(token, jwtSecret) as any;

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
  });

  io.on('connection', async (socket) => {
    const userId = (socket as any).user?.user_id;
    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log(`✅ [Socket] 사용자 연결: ${userId} (socket.id: ${socket.id})`);

    /**
     * 채팅방 입장
     * 클라이언트에서: socket.emit('join_room', { roomId })
     */
    socket.on('join_room', async ({ roomId }: { roomId: string }) => {
      try {
        if (!roomId) {
          socket.emit('error', { message: 'roomId가 필요합니다.' });
          return;
        }

        // 채팅방 참여 여부 확인
        const participant = await AppDataSource.getRepository(ChatParticipant).findOne({
          where: {
            room_id: roomId,
            user_id: userId,
          },
        });

        if (!participant) {
          socket.emit('error', { message: '이 채팅방에 접근할 수 없습니다.' });
          return;
        }

        // Socket.io room에 참여
        socket.join(roomId);
        userRoomMap.set(userId, roomId);

        console.log(`✅ [Socket] 사용자 ${userId}가 채팅방 ${roomId}에 입장했습니다.`);

        // 입장 확인 메시지 전송
        socket.emit('joined_room', { roomId });
      } catch (error) {
        console.error('채팅방 입장 오류:', error);
        socket.emit('error', { message: '채팅방 입장 중 오류가 발생했습니다.' });
      }
    });

    /**
     * 채팅방 나가기
     * 클라이언트에서: socket.emit('leave_room', { roomId })
     */
    socket.on('leave_room', async ({ roomId }: { roomId: string }) => {
      try {
        if (roomId) {
          socket.leave(roomId);
          userRoomMap.delete(userId);
          console.log(`✅ [Socket] 사용자 ${userId}가 채팅방 ${roomId}에서 나갔습니다.`);
        }
      } catch (error) {
        console.error('채팅방 나가기 오류:', error);
      }
    });

    /**
     * 메시지 전송
     * 클라이언트에서: socket.emit('send_message', { roomId, content, contentType })
     */
    socket.on('send_message', async ({ roomId, content, contentType = 0 }: {
      roomId: string;
      content: string;
      contentType?: number;
    }) => {
      try {
        if (!roomId || !content || content.trim().length === 0) {
          socket.emit('error', { message: '메시지 내용을 입력해주세요.' });
          return;
        }

        // 채팅방 참여 여부 확인
        const participant = await AppDataSource.getRepository(ChatParticipant).findOne({
          where: {
            room_id: roomId,
            user_id: userId,
          },
        });

        if (!participant) {
          socket.emit('error', { message: '이 채팅방에 접근할 수 없습니다.' });
          return;
        }

        // 메시지 DB 저장
        const message = AppDataSource.getRepository(ChatMessage).create({
          room_id: roomId,
          sender_id: userId,
          content: content.trim(),
          content_type: contentType,
          read: false,
        });

        const savedMessage = await AppDataSource.getRepository(ChatMessage).save(message);

        // 채팅방의 last_message_at 업데이트
        await AppDataSource.getRepository(ChatRoom).update(
          { room_id: roomId },
          { last_message_at: savedMessage.created_at },
        );

        // 발신자 정보 조회
        const sender = await AppDataSource.getRepository(User).findOne({
          where: { user_id: userId },
          select: ['user_id', 'nickname', 'profile_image_url'],
        });

        // 메시지 객체 생성
        const messageData = {
          message_id: savedMessage.message_id,
          content: savedMessage.content,
          content_type: savedMessage.content_type,
          sender_id: savedMessage.sender_id,
          sender: sender
            ? {
              user_id: sender.user_id,
              nickname: sender.nickname,
              profile_image_url: sender.profile_image_url,
            }
            : null,
          read: savedMessage.read,
          created_at: savedMessage.created_at?.toISOString() || new Date().toISOString(),
        };

        // 채팅방의 모든 클라이언트에게 메시지 전송 (실시간)
        io.to(roomId).emit('new_message', messageData);

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ [Socket] 메시지 전송: roomId=${roomId}, senderId=${userId}`);
        }

        // 푸시 알림 전송 (수신자가 채팅방에 없거나 오프라인인 경우)
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(`📱 [Push] 푸시 알림 전송 로직 시작: roomId=${roomId}, senderId=${userId}`);
            console.log(`📱 [Push] Firebase 초기화 상태: ${isFirebaseInitialized()}`);
          }

          // 채팅방의 다른 참여자들 조회
          const participants = await AppDataSource.getRepository(ChatParticipant).find({
            where: { room_id: roomId },
          });
          if (process.env.NODE_ENV === 'development') {
            console.log(`📱 [Push] 채팅방 참여자 수: ${participants.length}`);
          }

          // 소켓에 연결된 사용자 확인
          const connectedUserIds = new Set<string>();
          const sockets = await io.in(roomId).fetchSockets();
          sockets.forEach(socket => {
            const socketUserId = (socket as any).user?.user_id;
            if (socketUserId) {
              connectedUserIds.add(socketUserId);
            }
          });
          if (process.env.NODE_ENV === 'development') {
            console.log(`📱 [Push] 연결된 사용자 수: ${connectedUserIds.size}`, Array.from(connectedUserIds));
          }

          // 각 참여자에게 푸시 알림 전송 (발신자 제외, 연결되지 않은 사용자만)
          for (const participant of participants) {
            if (participant.user_id === userId) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`📱 [Push] 발신자 제외: ${participant.user_id}`);
              }
              continue; // 발신자는 제외
            }

            // 소켓에 연결되어 있지 않은 경우에만 푸시 알림 전송
            if (!connectedUserIds.has(participant.user_id)) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`📱 [Push] 연결되지 않은 사용자 확인: ${participant.user_id}`);
              }

              const recipient = await AppDataSource.getRepository(User).findOne({
                where: { user_id: participant.user_id },
                select: ['user_id', 'fcm_token', 'is_push_notification_enabled', 'nickname'],
              });

              if (process.env.NODE_ENV === 'development') {
                console.log(`📱 [Push] 수신자 정보:`, {
                  user_id: recipient?.user_id,
                  has_fcm_token: !!recipient?.fcm_token,
                  fcm_token_preview: recipient?.fcm_token ? recipient.fcm_token.substring(0, 20) + '...' : null,
                  is_push_notification_enabled: recipient?.is_push_notification_enabled,
                  is_firebase_initialized: isFirebaseInitialized(),
                });
              }

              if (
                recipient &&
                recipient.fcm_token &&
                recipient.is_push_notification_enabled &&
                isFirebaseInitialized()
              ) {
                const messagePreview = contentType === 0
                  ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
                  : contentType === 1
                    ? '📷 사진'
                    : contentType === 2
                      ? '🎥 동영상'
                      : '📎 파일';

                if (process.env.NODE_ENV === 'development') {
                  console.log(`📱 [Push] 푸시 알림 전송 시도: recipient=${recipient.user_id}, roomId=${roomId}, preview=${messagePreview}`);
                }

                const pushResult = await sendPushNotification(recipient.fcm_token, {
                  title: sender?.nickname || '알 수 없음',
                  body: messagePreview,
                  data: {
                    type: 'chat',
                    roomId: roomId,
                    senderId: userId,
                    senderNickname: sender?.nickname || '알 수 없음',
                    senderName: sender?.nickname || '알 수 없음', // 프론트엔드 호환성
                    message: messagePreview, // 프론트엔드에서 사용
                  },
                });

                if (process.env.NODE_ENV === 'development') {
                  console.log(`📱 [Push] 푸시 알림 전송 결과: recipient=${recipient.user_id}, roomId=${roomId}, success=${pushResult}`);
                }
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.log(`📱 [Push] 푸시 알림 전송 조건 불만족:`, {
                    has_recipient: !!recipient,
                    has_fcm_token: !!recipient?.fcm_token,
                    is_push_enabled: recipient?.is_push_notification_enabled,
                    is_firebase_initialized: isFirebaseInitialized(),
                  });
                }
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log(`📱 [Push] 사용자가 연결되어 있어 푸시 알림 스킵: ${participant.user_id}`);
              }
            }
          }
        } catch (pushError) {
          console.error('❌ [Push] 푸시 알림 전송 오류:', pushError);
          // 푸시 알림 실패는 메시지 전송을 막지 않음
        }
      } catch (error) {
        console.error('메시지 전송 오류:', error);
        socket.emit('error', { message: '메시지 전송 중 오류가 발생했습니다.' });
      }
    });

    /**
     * 메시지 읽음 처리
     * 클라이언트에서: socket.emit('mark_read', { roomId, messageId })
     */
    socket.on('mark_read', async ({ roomId, messageId }: { roomId: string; messageId?: string }) => {
      try {
        // 특정 메시지 읽음 처리 또는 채팅방의 모든 메시지 읽음 처리
        if (messageId) {
          await AppDataSource.getRepository(ChatMessage).update(
            { message_id: messageId },
            { read: true },
          );
        } else if (roomId) {
          // 채팅방의 모든 읽지 않은 메시지를 읽음 처리 (상대방이 보낸 메시지만)
          await AppDataSource.getRepository(ChatMessage)
            .createQueryBuilder()
            .update(ChatMessage)
            .set({ read: true })
            .where('room_id = :roomId', { roomId })
            .andWhere('sender_id != :userId', { userId })
            .andWhere('read = :read', { read: false })
            .execute();
        }

        // 다른 참여자에게 읽음 처리 알림 (선택사항)
        socket.to(roomId).emit('message_read', { roomId, messageId });
      } catch (error) {
        console.error('메시지 읽음 처리 오류:', error);
      }
    });

    /**
     * 연결 해제 시 정리
     */
    socket.on('disconnect', () => {
      userRoomMap.delete(userId);
      console.log(`❌ [Socket] 사용자 연결 해제: ${userId} (socket.id: ${socket.id})`);
    });

    /**
     * 에러 처리
     */
    socket.on('error', (error) => {
      console.error(`❌ [Socket] 에러 발생 (userId: ${userId}):`, error);
    });
  });
};

