import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {Term} from '../models/User';

/**
 * 약관 컨트롤러
 */
export class TermsController {
  /**
   * 약관 목록 조회
   * GET /api/terms
   */
  static async getTerms(req: Request, res: Response) {
    try {
      const termRepository = AppDataSource.getRepository(Term);

      const terms = await termRepository.find({
        order: {term_id: 'ASC'},
      });

      const formattedTerms = terms.map(term => ({
        term_id: term.term_id,
        title: term.title,
        content: term.content,
        req: term.req,
      }));

      return res.json({
        success: true,
        data: formattedTerms,
      });
    } catch (error) {
      console.error('약관 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '약관 목록을 불러오는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 약관 상세 조회
   * GET /api/terms/:termId
   */
  static async getTermDetail(req: Request, res: Response) {
    try {
      const {termId} = req.params;
      if (!termId) {
        return res.status(400).json({
          success: false,
          message: 'termId가 필요합니다.',
        });
      }
      const termRepository = AppDataSource.getRepository(Term);

      const term = await termRepository.findOne({
        where: {term_id: parseInt(termId)},
      });

      if (!term) {
        return res.status(404).json({
          success: false,
          message: '약관을 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          term_id: term.term_id,
          title: term.title,
          content: term.content,
          req: term.req,
        },
      });
    } catch (error) {
      console.error('약관 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '약관을 불러오는 중 오류가 발생했습니다.',
      });
    }
  }
}

