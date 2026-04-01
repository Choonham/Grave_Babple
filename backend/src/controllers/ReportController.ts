import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {UserReport, HiddenUser} from '../models/Report';
import {User} from '../models/User';
import {EmailService} from '../services/EmailService';

/**
 * 신고 및 숨김 처리 컨트롤러
 */
export class ReportController {
  /**
   * 사용자 신고
   * POST /api/reports/users
   * body: { 
   *   reported_user_id: string, 
   *   report_reason: string, 
   *   report_detail?: string,
   *   report_type?: 'USER' | 'POST' | 'CHAT',
   *   recipe_post_id?: string,
   *   chat_message_id?: string,
   *   chat_room_id?: string
   * }
   */
  static async reportUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {
        reported_user_id,
        report_reason,
        report_detail,
        report_type = 'USER',
        recipe_post_id,
        chat_message_id,
        chat_room_id,
      } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      if (!reported_user_id) {
        return res.status(400).json({
          success: false,
          message: '신고할 사용자 ID가 필요합니다.',
        });
      }

      if (!report_reason || report_reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '신고 사유를 입력해주세요.',
        });
      }

      // 신고 타입 검증
      if (!['USER', 'POST', 'CHAT'].includes(report_type)) {
        return res.status(400).json({
          success: false,
          message: '올바른 신고 타입이 아닙니다. (USER, POST, CHAT 중 하나)',
        });
      }

      // 신고 타입에 따른 필수 필드 검증
      if (report_type === 'POST' && !recipe_post_id) {
        return res.status(400).json({
          success: false,
          message: '게시글 신고인 경우 게시글 ID가 필요합니다.',
        });
      }

      if (report_type === 'CHAT' && !chat_message_id && !chat_room_id) {
        return res.status(400).json({
          success: false,
          message: '채팅 신고인 경우 채팅 메시지 ID 또는 채팅방 ID가 필요합니다.',
        });
      }

      if (userId === reported_user_id) {
        return res.status(400).json({
          success: false,
          message: '자기 자신을 신고할 수 없습니다.',
        });
      }

      // 신고 대상 사용자 존재 확인
      const reportedUser = await AppDataSource.getRepository(User).findOne({
        where: {user_id: reported_user_id, delete_yn: false},
      });

      if (!reportedUser) {
        return res.status(404).json({
          success: false,
          message: '신고할 사용자를 찾을 수 없습니다.',
        });
      }

      // 게시글 신고인 경우 게시글 존재 확인
      if (report_type === 'POST' && recipe_post_id) {
        const {RecipePost} = await import('../models/Post');
        const recipePost = await AppDataSource.getRepository(RecipePost).findOne({
          where: {recipe_post_id: recipe_post_id, delete_yn: false},
        });

        if (!recipePost) {
          return res.status(404).json({
            success: false,
            message: '신고할 게시글을 찾을 수 없습니다.',
          });
        }

        // 게시글 작성자가 신고 대상 사용자와 일치하는지 확인
        if (recipePost.user_id !== reported_user_id) {
          return res.status(400).json({
            success: false,
            message: '게시글 작성자와 신고 대상 사용자가 일치하지 않습니다.',
          });
        }
      }

      // 채팅 신고인 경우 채팅 메시지 또는 채팅방 존재 확인
      if (report_type === 'CHAT') {
        if (chat_message_id) {
          const {ChatMessage} = await import('../models/Chat');
          const chatMessage = await AppDataSource.getRepository(ChatMessage).findOne({
            where: {message_id: chat_message_id},
          });

          if (!chatMessage) {
            return res.status(404).json({
              success: false,
              message: '신고할 채팅 메시지를 찾을 수 없습니다.',
            });
          }

          // 채팅 메시지 발신자가 신고 대상 사용자와 일치하는지 확인
          if (chatMessage.sender_id !== reported_user_id) {
            return res.status(400).json({
              success: false,
              message: '채팅 메시지 발신자와 신고 대상 사용자가 일치하지 않습니다.',
            });
          }
        }

        if (chat_room_id) {
          const {ChatRoom} = await import('../models/Chat');
          const chatRoom = await AppDataSource.getRepository(ChatRoom).findOne({
            where: {room_id: chat_room_id},
          });

          if (!chatRoom) {
            return res.status(404).json({
              success: false,
              message: '신고할 채팅방을 찾을 수 없습니다.',
            });
          }
        }
      }

      // 중복 신고 확인 (PENDING 또는 PROCESSING 상태인 신고가 있는지)
      // 같은 타입의 신고만 중복 체크 (게시글/채팅 신고는 같은 항목에 대한 중복만 체크)
      const existingReportQuery: any = {
        reporter_id: userId,
        reported_user_id: reported_user_id,
        status: 'PENDING' as any,
        report_type: report_type,
      };

      if (report_type === 'POST' && recipe_post_id) {
        existingReportQuery.recipe_post_id = recipe_post_id;
      } else if (report_type === 'CHAT') {
        if (chat_message_id) {
          existingReportQuery.chat_message_id = chat_message_id;
        }
        if (chat_room_id) {
          existingReportQuery.chat_room_id = chat_room_id;
        }
      }

      const existingReport = await AppDataSource.getRepository(UserReport).findOne({
        where: existingReportQuery,
      });

      if (existingReport) {
        const reportTypeName = report_type === 'POST' ? '게시글' : report_type === 'CHAT' ? '채팅' : '사용자';
        return res.status(400).json({
          success: false,
          message: `이미 신고한 ${reportTypeName}입니다. 신고가 처리 완료되면 다시 신고할 수 있습니다.`,
        });
      }

      // 신고 생성
      const report = AppDataSource.getRepository(UserReport).create({
        reporter_id: userId,
        reported_user_id: reported_user_id,
        report_type: report_type,
        recipe_post_id: report_type === 'POST' ? recipe_post_id : null,
        chat_message_id: report_type === 'CHAT' ? chat_message_id : null,
        chat_room_id: report_type === 'CHAT' ? chat_room_id : null,
        report_reason: report_reason.trim(),
        report_detail: report_detail ? report_detail.trim() : null,
        status: 'PENDING',
      });

      await AppDataSource.getRepository(UserReport).save(report);

      return res.status(201).json({
        success: true,
        message: '신고가 접수되었습니다. 검토 후 처리하겠습니다.',
        data: {
          report_id: report.report_id,
        },
      });
    } catch (error) {
      console.error('사용자 신고 오류:', error);
      return res.status(500).json({
        success: false,
        message: '신고 처리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 사용자 숨김 처리
   * POST /api/reports/users/:userId/hide
   */
  static async hideUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {userId: targetUserId} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      if (userId === targetUserId) {
        return res.status(400).json({
          success: false,
          message: '자기 자신을 숨김 처리할 수 없습니다.',
        });
      }

      // 숨김 대상 사용자 존재 확인
      const targetUser = await AppDataSource.getRepository(User).findOne({
        where: {user_id: targetUserId, delete_yn: false},
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: '숨김 처리할 사용자를 찾을 수 없습니다.',
        });
      }

      // 이미 숨김 처리했는지 확인
      const existingHidden = await AppDataSource.getRepository(HiddenUser).findOne({
        where: {
          user_id: userId,
          hidden_user_id: targetUserId,
        },
      });

      if (existingHidden) {
        return res.status(400).json({
          success: false,
          message: '이미 숨김 처리한 사용자입니다.',
        });
      }

      // 숨김 처리 생성
      const hidden = AppDataSource.getRepository(HiddenUser).create({
        user_id: userId,
        hidden_user_id: targetUserId,
      });

      await AppDataSource.getRepository(HiddenUser).save(hidden);

      return res.status(201).json({
        success: true,
        message: '사용자가 숨김 처리되었습니다.',
        data: {
          hidden_id: hidden.hidden_id,
        },
      });
    } catch (error) {
      console.error('사용자 숨김 처리 오류:', error);
      return res.status(500).json({
        success: false,
        message: '숨김 처리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 사용자 숨김 해제
   * DELETE /api/reports/users/:userId/hide
   */
  static async unhideUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {userId: targetUserId} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 숨김 처리 제거
      const result = await AppDataSource.getRepository(HiddenUser).delete({
        user_id: userId,
        hidden_user_id: targetUserId,
      });

      if (result.affected === 0) {
        return res.status(404).json({
          success: false,
          message: '숨김 처리된 사용자가 아닙니다.',
        });
      }

      return res.json({
        success: true,
        message: '숨김 처리가 해제되었습니다.',
      });
    } catch (error) {
      console.error('사용자 숨김 해제 오류:', error);
      return res.status(500).json({
        success: false,
        message: '숨김 해제 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 숨김 처리한 사용자 목록 조회
   * GET /api/reports/users/hidden
   */
  static async getHiddenUsers(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const hiddenUsers = await AppDataSource.getRepository(HiddenUser)
        .createQueryBuilder('hidden')
        .leftJoinAndSelect('hidden.hiddenUser', 'user')
        .where('hidden.user_id = :userId', {userId})
        .orderBy('hidden.created_at', 'DESC')
        .getMany();

      const formatted = hiddenUsers.map((hidden) => ({
        hidden_id: hidden.hidden_id,
        user: hidden.hiddenUser
          ? {
              user_id: hidden.hiddenUser.user_id,
              nickname: hidden.hiddenUser.nickname,
              profile_image_url: hidden.hiddenUser.profile_image_url,
            }
          : null,
        created_at: hidden.created_at,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('숨김 사용자 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '숨김 사용자 목록 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 신고 처리 완료 후 신고자에게 이메일 발송 (관리자용)
   * 내부 함수로 사용되며, 신고 상태가 RESOLVED로 변경될 때 호출됨
   */
  static async sendReportResultEmail(report: UserReport) {
    try {
      // 신고자 정보 조회
      const reporter = await AppDataSource.getRepository(User).findOne({
        where: {user_id: report.reporter_id},
        select: ['user_id', 'email', 'nickname'],
      });

      if (!reporter || !reporter.email) {
        console.warn('신고자 이메일이 없어 결과 이메일을 발송할 수 없습니다.');
        return;
      }

      // 신고 대상 사용자 정보 조회
      const reportedUser = await AppDataSource.getRepository(User).findOne({
        where: {user_id: report.reported_user_id},
        select: ['user_id', 'nickname'],
      });

      const reportedUserName = reportedUser?.nickname || '사용자';

      // 제제 조치에 따른 메시지 생성
      let actionMessage = '';
      let penaltyDetail = '';

      switch (report.penalty_action) {
        case 'WARNING':
          actionMessage = '경고 조치';
          penaltyDetail = '경고 조치가 적용되었습니다.';
          break;
        case 'SUSPEND_7DAYS':
          actionMessage = '7일 계정 정지';
          penaltyDetail = '7일간 계정이 정지되었습니다.';
          break;
        case 'SUSPEND_30DAYS':
          actionMessage = '30일 계정 정지';
          penaltyDetail = '30일간 계정이 정지되었습니다.';
          break;
        case 'BAN':
          actionMessage = '영구 정지';
          penaltyDetail = '계정이 영구적으로 정지되었습니다.';
          break;
        case 'NONE':
          actionMessage = '조치 없음';
          penaltyDetail = '검토 결과 조치가 필요하지 않은 것으로 판단되었습니다.';
          break;
        default:
          actionMessage = '처리 완료';
          penaltyDetail = '신고가 처리되었습니다.';
      }

      await EmailService.sendReportResultEmail(
        reporter.email,
        reporter.nickname,
        reportedUserName,
        report.report_reason,
        report.penalty_action || 'NONE',
        report.admin_comment,
      );

      console.log(`✅ 신고 결과 이메일 발송 완료: ${reporter.email}`);
    } catch (error) {
      console.error('신고 결과 이메일 발송 오류:', error);
      // 이메일 발송 실패해도 신고 처리는 완료되었으므로 에러를 throw하지 않음
    }
  }
}

