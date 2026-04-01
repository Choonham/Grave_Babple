import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {ChatRoom, ChatParticipant, ChatMessage} from '../models/Chat';
import {User} from '../models/User';

/**
 * 채팅 컨트롤러
 * 채팅 관련 모든 기능을 담당
 */
export class ChatController {
  /**
   * 채팅방 목록 조회
   * GET /api/chat/rooms
   */
  static async getRooms(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 사용자가 참여한 채팅방 조회 (메시지가 있는 경우에만 정렬, 없으면 생성 시간 기준)
      const rooms = await AppDataSource.getRepository(ChatRoom)
        .createQueryBuilder('room')
        .innerJoin('room.participants', 'participant', 'participant.user_id = :userId', {userId})
        .leftJoinAndSelect('room.participants', 'allParticipants')
        .leftJoinAndSelect('allParticipants.user', 'user')
        .leftJoin('room.messages', 'lastMessage')
        .addSelect([
          'lastMessage.message_id',
          'lastMessage.content',
          'lastMessage.content_type',
          'lastMessage.created_at',
          'lastMessage.sender_id',
          'lastMessage.read',
        ])
        .orderBy('COALESCE(room.last_message_at, room.created_at)', 'DESC')
        .getMany();

      // 각 채팅방의 상대방 정보와 마지막 메시지 정보 포함
      const formattedRooms = await Promise.all(
        rooms.map(async (room) => {
          // 상대방 찾기 (현재 사용자가 아닌 참여자)
          const otherParticipant = room.participants.find((p: any) => p.user_id !== userId);
          
          // 상대방이 없는 경우 스킵 (1:1 채팅이므로 상대방이 반드시 있어야 함)
          if (!otherParticipant) {
            return null;
          }
          
          const otherUser = otherParticipant?.user;
          
          // 상대방 사용자 정보가 없는 경우도 스킵
          if (!otherUser) {
            return null;
          }

          // 마지막 메시지 조회
          const lastMessage = await AppDataSource.getRepository(ChatMessage)
            .createQueryBuilder('message')
            .where('message.room_id = :roomId', {roomId: room.room_id})
            .orderBy('message.created_at', 'DESC')
            .limit(1)
            .getOne();

          // 읽지 않은 메시지 개수 (상대방이 보낸 메시지만 카운트)
          const unreadCount = await AppDataSource.getRepository(ChatMessage).count({
            where: {
              room_id: room.room_id,
              sender_id: otherUser.user_id,
              read: false,
            },
          });

          return {
            room_id: room.room_id,
            other_user: {
              user_id: otherUser.user_id,
              nickname: otherUser.nickname,
              profile_image_url: otherUser.profile_image_url,
            },
            last_message: lastMessage
              ? {
                  message_id: lastMessage.message_id,
                  content: lastMessage.content,
                  content_type: lastMessage.content_type,
                  created_at: lastMessage.created_at?.toISOString() || new Date().toISOString(),
                  sender_id: lastMessage.sender_id,
                }
              : null,
            unread_count: unreadCount,
            last_message_at: room.last_message_at?.toISOString() || null,
          };
        }),
      );

      // null 값 필터링 (상대방이 없는 채팅방 제외)
      const validRooms = formattedRooms.filter((room) => room !== null);

      return res.json({
        success: true,
        data: validRooms,
      });
    } catch (error) {
      console.error('채팅방 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '채팅방 목록 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 채팅방 생성 또는 조회
   * POST /api/chat/rooms
   * body: { other_user_id: string }
   */
  static async createOrGetRoom(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {other_user_id} = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      if (!other_user_id) {
        return res.status(400).json({
          success: false,
          message: '상대방 사용자 ID가 필요합니다.',
        });
      }

      if (userId === other_user_id) {
        return res.status(400).json({
          success: false,
          message: '자기 자신과는 채팅할 수 없습니다.',
        });
      }

      // 기존 채팅방이 있는지 확인
      const existingRoom = await AppDataSource.getRepository(ChatParticipant)
        .createQueryBuilder('p1')
        .innerJoin('p1.room', 'room')
        .innerJoin(
          ChatParticipant,
          'p2',
          'p2.room_id = p1.room_id AND p2.user_id = :otherUserId',
          {otherUserId: other_user_id},
        )
        .where('p1.user_id = :userId', {userId})
        .select(['room.room_id', 'room.created_at', 'room.last_message_at'])
        .getRawOne();

      if (existingRoom) {
        // 기존 채팅방 반환
        const room = await AppDataSource.getRepository(ChatRoom).findOne({
          where: {room_id: existingRoom.room_room_id},
          relations: ['participants', 'participants.user'],
        });

        const otherParticipant = room?.participants.find((p: any) => p.user_id === other_user_id);
        const otherUser = otherParticipant?.user;

        return res.json({
          success: true,
          data: {
            room_id: room?.room_id,
            other_user: otherUser
              ? {
                  user_id: otherUser.user_id,
                  nickname: otherUser.nickname,
                  profile_image_url: otherUser.profile_image_url,
                }
              : null,
          },
        });
      }

      // 새 채팅방 생성
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 채팅방 생성
        const newRoom = queryRunner.manager.create(ChatRoom, {});
        const savedRoom = await queryRunner.manager.save(newRoom);

        // 참여자 추가
        const participant1 = queryRunner.manager.create(ChatParticipant, {
          user_id: userId,
          room_id: savedRoom.room_id,
        });
        const participant2 = queryRunner.manager.create(ChatParticipant, {
          user_id: other_user_id,
          room_id: savedRoom.room_id,
        });

        await queryRunner.manager.save([participant1, participant2]);

        await queryRunner.commitTransaction();

        // 상대방 정보 조회
        const otherUser = await AppDataSource.getRepository(User).findOne({
          where: {user_id: other_user_id},
          select: ['user_id', 'nickname', 'profile_image_url'],
        });

        return res.status(201).json({
          success: true,
          data: {
            room_id: savedRoom.room_id,
            other_user: otherUser
              ? {
                  user_id: otherUser.user_id,
                  nickname: otherUser.nickname,
                  profile_image_url: otherUser.profile_image_url,
                }
              : null,
          },
        });
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error('채팅방 생성 오류:', error);
      return res.status(500).json({
        success: false,
        message: '채팅방 생성 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 채팅방 메시지 조회
   * GET /api/chat/rooms/:roomId/messages
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {roomId} = req.params;
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const before = req.query.before as string | undefined; // 페이지네이션용

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 채팅방 참여 여부 확인
      const participant = await AppDataSource.getRepository(ChatParticipant).findOne({
        where: {
          room_id: roomId,
          user_id: userId,
        },
      });

      if (!participant) {
        return res.status(403).json({
          success: false,
          message: '이 채팅방에 접근할 수 없습니다.',
        });
      }

      // 메시지 조회
      let query = AppDataSource.getRepository(ChatMessage)
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .where('message.room_id = :roomId', {roomId})
        .orderBy('message.created_at', 'DESC')
        .limit(limit);

      if (before) {
        query = query.andWhere('message.created_at < :before', {before});
      }

      const messages = await query.getMany();

      // 메시지 읽음 처리 (상대방이 보낸 메시지만)
      const unreadMessages = messages.filter(
        (msg) => msg.sender_id !== userId && !msg.read,
      );
      if (unreadMessages.length > 0) {
        const unreadMessageIds = unreadMessages.map((m) => m.message_id);
        for (const messageId of unreadMessageIds) {
          await AppDataSource.getRepository(ChatMessage).update(
            {message_id: messageId},
            {read: true},
          );
        }
      }

      // 최신 메시지가 있으면 채팅방의 last_message_at 업데이트
      if (messages.length > 0) {
        const latestMessage = messages[0];
        if (latestMessage) {
          await AppDataSource.getRepository(ChatRoom).update(
            {room_id: roomId},
            {last_message_at: latestMessage.created_at},
          );
        }
      }

      // 역순으로 정렬 (오래된 것부터)
      const formattedMessages = messages
        .reverse()
        .map((message) => ({
          message_id: message.message_id,
          content: message.content,
          content_type: message.content_type,
          sender_id: message.sender_id,
          sender: message.sender
            ? {
                user_id: message.sender.user_id,
                nickname: message.sender.nickname,
                profile_image_url: message.sender.profile_image_url,
              }
            : null,
          read: message.read,
          created_at: message.created_at?.toISOString() || new Date().toISOString(),
        }));

      return res.json({
        success: true,
        data: formattedMessages,
      });
    } catch (error) {
      console.error('메시지 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '메시지 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 메시지 전송
   * POST /api/chat/rooms/:roomId/messages
   */
  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {roomId} = req.params;
      const {content, content_type = 0} = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '메시지 내용을 입력해주세요.',
        });
      }

      // 채팅방 참여 여부 확인
      const participant = await AppDataSource.getRepository(ChatParticipant).findOne({
        where: {
          room_id: roomId,
          user_id: userId,
        },
      });

      if (!participant) {
        return res.status(403).json({
          success: false,
          message: '이 채팅방에 접근할 수 없습니다.',
        });
      }

      // 메시지 생성
      const message = AppDataSource.getRepository(ChatMessage).create({
        room_id: roomId,
        sender_id: userId,
        content: content.trim(),
        content_type: content_type,
        read: false,
      });

      const savedMessage = await AppDataSource.getRepository(ChatMessage).save(message);

      // 채팅방의 last_message_at 업데이트
      await AppDataSource.getRepository(ChatRoom).update(
        {room_id: roomId},
        {last_message_at: savedMessage.created_at},
      );

      // 발신자 정보 포함하여 반환
      const sender = await AppDataSource.getRepository(User).findOne({
        where: {user_id: userId},
        select: ['user_id', 'nickname', 'profile_image_url'],
      });

      return res.status(201).json({
        success: true,
        data: {
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
          created_at: savedMessage.created_at,
        },
      });
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      return res.status(500).json({
        success: false,
        message: '메시지 전송 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 채팅방 나가기
   * DELETE /api/chat/rooms/:roomId/leave
   */
  static async leaveRoom(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {roomId} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 채팅방 참여 여부 확인
      const participant = await AppDataSource.getRepository(ChatParticipant).findOne({
        where: {
          room_id: roomId,
          user_id: userId,
        },
      });

      if (!participant) {
        return res.status(404).json({
          success: false,
          message: '채팅방을 찾을 수 없거나 이미 나간 채팅방입니다.',
        });
      }

      // 참여자에서 제거
      await AppDataSource.getRepository(ChatParticipant).delete({
        room_id: roomId,
        user_id: userId,
      });

      // 채팅방에 남은 참여자 확인
      const remainingParticipants = await AppDataSource.getRepository(ChatParticipant).count({
        where: {room_id: roomId},
      });

      // 참여자가 없으면 채팅방 삭제 (선택사항)
      // 일반적으로는 채팅방을 유지하고, 참여자가 다시 참여할 수 있도록 하는 것이 좋습니다.
      // 여기서는 채팅방을 유지하도록 구현합니다.

      return res.json({
        success: true,
        message: '채팅방에서 나갔습니다.',
      });
    } catch (error) {
      console.error('채팅방 나가기 오류:', error);
      return res.status(500).json({
        success: false,
        message: '채팅방 나가기 중 오류가 발생했습니다.',
      });
    }
  }
}

