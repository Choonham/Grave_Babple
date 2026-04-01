import {Request, Response} from 'express';
import {MoreThan} from 'typeorm';
import {AppDataSource} from '../config/database';
import {SearchLog} from '../models/Search';
import {isProfane} from '../utils/profanityFilter';

export class SearchController {
  /**
   * 최근 검색 키워드를 기록합니다.
   * POST /api/search/log
   */
  static async recordSearch(req: Request, res: Response) {
    try {
      const rawKeyword = typeof req.body?.keyword === 'string' ? req.body.keyword.trim() : '';
      const rawType = typeof req.body?.search_type === 'string' ? req.body.search_type.trim() : null;

      if (rawKeyword.length === 0) {
        return res.status(400).json({
          success: false,
          message: '검색 키워드가 필요합니다.',
        });
      }

      const keyword = rawKeyword.slice(0, 100);
      const searchType = rawType ? rawType.slice(0, 20) : null;

      // 욕설 필터링 체크
      if (isProfane(keyword)) {
        console.log(`🚫 [SearchController] 부적절한 검색어 차단: "${keyword}"`);
        
        // 사용자에게는 정상 응답 (검색은 가능하되 저장만 하지 않음)
        return res.json({
          success: true,
          message: '검색어가 기록되었습니다.',
          data: {
            keyword,
            search_type: searchType,
            filtered: true, // 필터링됨을 표시 (로그용)
          },
        });
      }

      const repository = AppDataSource.getRepository(SearchLog);

      const log = repository.create({
        keyword,
        search_type: searchType,
      });

      await repository.save(log);

      return res.json({
        success: true,
        data: {
          keyword,
          search_type: searchType,
          filtered: false,
        },
      });
    } catch (error) {
      console.error('❌ [SearchController] 검색 기록 저장 실패:', error);
      return res.status(500).json({
        success: false,
        message: '검색 기록을 저장하는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 최근 24시간 동안 가장 많이 검색된 키워드를 조회합니다.
   * GET /api/search/trending
   */
  static async getTrendingSearches(req: Request, res: Response) {
    try {
      const hours = Number(req.query?.hours) || 24;
      const limit = Math.min(Number(req.query?.limit) || 20, 50);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const repository = AppDataSource.getRepository(SearchLog);

      const rows = await repository
        .createQueryBuilder('log')
        .select('LOWER(log.keyword)', 'normalized')
        .addSelect('MIN(log.keyword)', 'keyword')
        .addSelect('COUNT(*)', 'count')
        .where('log.created_at >= :since', {since})
        .groupBy('normalized')
        .orderBy('count', 'DESC')
        .addOrderBy('keyword', 'ASC')
        .limit(limit)
        .getRawMany();

      const data = rows.map(row => ({
        keyword: row.keyword as string,
        count: Number(row.count) || 0,
      }));

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('❌ [SearchController] 인기 검색어 조회 실패:', error);
      return res.status(500).json({
        success: false,
        message: '인기 검색어를 조회하는 중 오류가 발생했습니다.',
      });
    }
  }
}
