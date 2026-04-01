import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {Announcement} from '../models/App';

/**
 * 공지사항 컨트롤러
 */
export class AnnouncementController {
  /**
   * 공지사항 목록 조회
   * GET /api/announcements
   */
  static async getAnnouncements(req: Request, res: Response) {
    try {
      const announcementRepository = AppDataSource.getRepository(Announcement);

      const announcements = await announcementRepository.find({
        where: {del_yn: false},
        order: {
          important: 'DESC', // 중요 공지 먼저
          created_at: 'DESC',
        },
      });

      const formattedAnnouncements = announcements.map(announcement => {
        const createdAt = new Date(announcement.created_at);
        const dateStr = createdAt.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        return {
          announce_code: announcement.announce_code,
          title: announcement.title,
          content: announcement.content,
          date: dateStr,
          important: announcement.important,
          view_count: announcement.view_count,
          created_at: announcement.created_at,
        };
      });

      return res.json({
        success: true,
        data: formattedAnnouncements,
      });
    } catch (error) {
      console.error('공지사항 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '공지사항 목록을 불러오는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 공지사항 상세 조회
   * GET /api/announcements/:announceCode
   */
  static async getAnnouncementDetail(req: Request, res: Response) {
    try {
      const {announceCode} = req.params;
      if (!announceCode) {
        return res.status(400).json({
          success: false,
          message: 'announceCode가 필요합니다.',
        });
      }
      const announcementRepository = AppDataSource.getRepository(Announcement);

      const announcement = await announcementRepository.findOne({
        where: {
          announce_code: parseInt(announceCode),
          del_yn: false,
        },
      });

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: '공지사항을 찾을 수 없습니다.',
        });
      }

      // 조회수 증가
      announcement.view_count += 1;
      await announcementRepository.save(announcement);

      const createdAt = new Date(announcement.created_at);
      const dateStr = createdAt.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return res.json({
        success: true,
        data: {
          announce_code: announcement.announce_code,
          title: announcement.title,
          content: announcement.content,
          date: dateStr,
          important: announcement.important,
          view_count: announcement.view_count,
          created_at: announcement.created_at,
        },
      });
    } catch (error) {
      console.error('공지사항 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '공지사항을 불러오는 중 오류가 발생했습니다.',
      });
    }
  }
}

