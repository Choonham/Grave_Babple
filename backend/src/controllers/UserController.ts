import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {User, Relationship, Title, UserTitle} from '../models/User';
import {RecipePost, RecipePostImage} from '../models/Post';
import {Like} from '../models/Interaction';
import {TitleService} from '../services/TitleService';
import {NotificationController} from './NotificationController';
import {normalizeToRelativePath} from '../utils/imageUrl';

export class UserController {
  /**
   * 닉네임으로 사용자 검색
   * GET /api/users/search?keyword=...
   */
  static async searchUsers(req: Request, res: Response) {
    try {
      const rawKeyword = (req.query.keyword as string | undefined) ?? '';
      const keyword = rawKeyword.trim();

      if (keyword.length === 0) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const userRepository = AppDataSource.getRepository(User);

      const users = await userRepository
        .createQueryBuilder('user')
        .select([
          'user.user_id AS user_id',
          'user.nickname AS nickname',
          'user.profile_image_url AS profile_image_url',
          'user.introduction AS introduction',
        ])
        .where('user.delete_yn = false')
        .andWhere('LOWER(user.nickname) LIKE :keyword', {
          keyword: `%${keyword.toLowerCase()}%`,
        })
        .orderBy('user.nickname', 'ASC')
        .limit(30)
        .getRawMany();

      const formatted = users.map(user => ({
        user_id: user.user_id,
        nickname: user.nickname,
        profile_image_url: user.profile_image_url || null,
        introduction: user.introduction || null,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('사용자 검색 오류:', error);
      return res.status(500).json({
        success: false,
        message: '사용자 검색 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 프로필 정보 조회
   * GET /api/users/me/profile
   */
  static async getMyProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId, delete_yn: false},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // 레시피 개수
      const recipeCount = await AppDataSource.getRepository(RecipePost).count({
        where: {user_id: userId, delete_yn: false},
      });

      // 팔로워 수 (나를 팔로우하는 사람들)
      const followerCountResult = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM relationships WHERE following_id = $1`,
        [userId],
      );
      const followerCount = parseInt(followerCountResult[0]?.count || '0', 10);

      // 팔로잉 수 (내가 팔로우하는 사람들)
      const followingCountResult = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM relationships WHERE follower_id = $1`,
        [userId],
      );
      const followingCount = parseInt(followingCountResult[0]?.count || '0', 10);

      // 타이틀 조회
      const userTitles = await AppDataSource.getRepository(UserTitle)
        .createQueryBuilder('ut')
        .leftJoin('ut.title', 'title')
        .select([
          'title.title_id',
          'title.name',
          'title.description',
          'title.icon_url',
          'ut.achieved_at',
        ])
        .where('ut.user_id = :userId', {userId})
        .orderBy('ut.achieved_at', 'DESC')
        .getRawMany();

      const titles = userTitles.map(ut => ({
        title_id: ut.title_title_id,
        name: ut.title_name,
        description: ut.title_description,
        icon_url: ut.title_icon_url,
        achieved_at: ut.ut_achieved_at,
      }));

      // 자기소개를 줄바꿈으로 분리
      const bio = user.introduction
        ? user.introduction.split('\n').filter(line => line.trim().length > 0)
        : [];

      return res.json({
        success: true,
        data: {
          user_id: user.user_id,
          nickname: user.nickname,
          profile_image_url: user.profile_image_url || null,
          bio: bio,
          location_text: user.location_text || null,
          gender: user.gender || null,
          age_group: user.age_group || null,
          stats: {
            recipes: recipeCount,
            regularCustomers: followerCount,
            regularStores: followingCount,
          },
          titles: titles,
        },
      });
    } catch (error) {
      console.error('프로필 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '프로필 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내가 획득한 타이틀 리스트 조회
   * GET /api/users/me/titles
   */
  static async getMyTitles(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 모든 타이틀 조회
      const allTitles = await AppDataSource.getRepository(Title)
        .createQueryBuilder('title')
        .select([
          'title.title_id',
          'title.name',
          'title.description',
          'title.icon_url',
        ])
        .orderBy('title.title_id', 'ASC')
        .getRawMany();

      // 사용자가 획득한 타이틀 ID 목록 조회
      const userTitles = await AppDataSource.getRepository(UserTitle)
        .createQueryBuilder('ut')
        .select('ut.title_id', 'title_id')
        .where('ut.user_id = :userId', {userId})
        .getRawMany();

      const achievedTitleIds = new Set(userTitles.map(ut => ut.title_id));

      // 모든 타이틀에 대해 획득 여부 추가
      const titles = allTitles.map(title => ({
        title_id: title.title_title_id,
        name: title.title_name,
        description: title.title_description,
        icon_url: title.title_icon_url || null,
        earned: achievedTitleIds.has(title.title_title_id),
      }));

      return res.json({
        success: true,
        data: titles,
      });
    } catch (error) {
      console.error('타이틀 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '타이틀 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내가 등록한 레시피 리스트 조회
   * GET /api/users/me/recipes
   */
  static async getMyRecipes(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipes = await recipeRepository
        .createQueryBuilder('recipe')
        .leftJoinAndSelect('recipe.images', 'images')
        .where('recipe.user_id = :userId', {userId})
        .andWhere('recipe.delete_yn = false')
        .orderBy('recipe.created_at', 'DESC')
        .getMany();

      const formatted = recipes.map(recipe => {
        // 첫 번째 이미지 썸네일
        const firstImage = recipe.images && recipe.images.length > 0
          ? recipe.images[0]
          : null;

        return {
          recipe_post_id: recipe.recipe_post_id,
          title: recipe.title,
          thumbnail_url: firstImage ? firstImage.image_url : null,
          like_count: recipe.like_count,
          comment_count: recipe.comment_count,
          created_at: recipe.created_at,
        };
      });

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('레시피 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '레시피 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내가 좋아요한 레시피 리스트 조회
   * GET /api/users/me/liked-recipes
   */
  static async getMyLikedRecipes(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const likeRepository = AppDataSource.getRepository(Like);
      const likes = await likeRepository
        .createQueryBuilder('like')
        .leftJoinAndSelect('like.recipePost', 'recipe')
        .leftJoinAndSelect('recipe.images', 'images')
        .where('like.user_id = :userId', {userId})
        .andWhere('recipe.delete_yn = false')
        .orderBy('like.created_at', 'DESC')
        .getMany();

      const formatted = likes.map(like => {
        const recipe = like.recipePost;
        // 첫 번째 이미지 썸네일
        const firstImage = recipe.images && recipe.images.length > 0
          ? recipe.images[0]
          : null;

        return {
          recipe_post_id: recipe.recipe_post_id,
          title: recipe.title,
          thumbnail_url: firstImage ? firstImage.image_url : null,
          like_count: recipe.like_count,
          comment_count: recipe.comment_count,
          created_at: recipe.created_at,
        };
      });

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('좋아요한 레시피 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '좋아요한 레시피 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 다른 유저의 프로필 정보 조회
   * GET /api/users/:userId/profile
   */
  static async getUserProfile(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;
      const currentUserId = (req as any).user?.user_id;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: targetUserId, delete_yn: false},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // 레시피 개수
      const recipeCount = await AppDataSource.getRepository(RecipePost).count({
        where: {user_id: targetUserId, delete_yn: false},
      });

      // 팔로워 수 (이 유저를 팔로우하는 사람들)
      const followerCountResult = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM relationships WHERE following_id = $1`,
        [targetUserId],
      );
      const followerCount = parseInt(followerCountResult[0]?.count || '0', 10);

      // 팔로잉 수 (이 유저가 팔로우하는 사람들)
      const followingCountResult = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM relationships WHERE follower_id = $1`,
        [targetUserId],
      );
      const followingCount = parseInt(followingCountResult[0]?.count || '0', 10);

      // 현재 사용자가 이 유저를 팔로우하는지 확인
      let isFollowing = false;
      if (currentUserId) {
        const relationshipCountResult = await AppDataSource.query(
          `SELECT COUNT(*) as count FROM relationships 
           WHERE follower_id = $1 AND following_id = $2`,
          [currentUserId, targetUserId],
        );
        isFollowing = parseInt(relationshipCountResult[0]?.count || '0', 10) > 0;
      }

      // 타이틀 조회
      const userTitles = await AppDataSource.getRepository(UserTitle)
        .createQueryBuilder('ut')
        .leftJoin('ut.title', 'title')
        .select([
          'title.title_id',
          'title.name',
          'title.description',
          'title.icon_url',
          'ut.achieved_at',
        ])
        .where('ut.user_id = :userId', {userId: targetUserId})
        .orderBy('ut.achieved_at', 'DESC')
        .getRawMany();

      const titles = userTitles.map(ut => ({
        title_id: ut.title_title_id,
        name: ut.title_name,
        description: ut.title_description,
        icon_url: ut.title_icon_url,
        achieved_at: ut.ut_achieved_at,
      }));

      // 자기소개를 줄바꿈으로 분리
      const bio = user.introduction
        ? user.introduction.split('\n').filter(line => line.trim().length > 0)
        : [];

      return res.json({
        success: true,
        data: {
          user_id: user.user_id,
          nickname: user.nickname,
          profile_image_url: user.profile_image_url || null,
          bio: bio,
          location_text: user.location_text || null,
          gender: user.gender || null,
          age_group: user.age_group || null,
          stats: {
            recipes: recipeCount,
            regularCustomers: followerCount,
            regularStores: followingCount,
          },
          titles: titles,
          isFollowing: isFollowing,
        },
      });
    } catch (error) {
      console.error('프로필 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '프로필 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 다른 유저가 등록한 레시피 리스트 조회
   * GET /api/users/:userId/recipes
   */
  static async getUserRecipes(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipes = await recipeRepository
        .createQueryBuilder('recipe')
        .leftJoinAndSelect('recipe.images', 'images')
        .where('recipe.user_id = :userId', {userId: targetUserId})
        .andWhere('recipe.delete_yn = false')
        .orderBy('recipe.created_at', 'DESC')
        .getMany();

      const formatted = recipes.map(recipe => {
        // 첫 번째 이미지 썸네일
        const firstImage = recipe.images && recipe.images.length > 0
          ? recipe.images[0]
          : null;

        return {
          recipe_post_id: recipe.recipe_post_id,
          title: recipe.title,
          thumbnail_url: firstImage ? firstImage.image_url : null,
          like_count: recipe.like_count,
          comment_count: recipe.comment_count,
          created_at: recipe.created_at,
        };
      });

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('레시피 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '레시피 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 다른 유저가 좋아요한 레시피 리스트 조회
   * GET /api/users/:userId/liked-recipes
   */
  static async getUserLikedRecipes(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const likeRepository = AppDataSource.getRepository(Like);
      const likes = await likeRepository
        .createQueryBuilder('like')
        .leftJoinAndSelect('like.recipePost', 'recipe')
        .leftJoinAndSelect('recipe.images', 'images')
        .where('like.user_id = :userId', {userId: targetUserId})
        .andWhere('recipe.delete_yn = false')
        .orderBy('like.created_at', 'DESC')
        .getMany();

      const formatted = likes.map(like => {
        const recipe = like.recipePost;
        // 첫 번째 이미지 썸네일
        const firstImage = recipe.images && recipe.images.length > 0
          ? recipe.images[0]
          : null;

        return {
          recipe_post_id: recipe.recipe_post_id,
          title: recipe.title,
          thumbnail_url: firstImage ? firstImage.image_url : null,
          like_count: recipe.like_count,
          comment_count: recipe.comment_count,
          created_at: recipe.created_at,
        };
      });

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('좋아요한 레시피 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '좋아요한 레시피 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 유저 팔로우
   * POST /api/users/:userId/follow
   */
  static async followUser(req: Request, res: Response) {
    try {
      const currentUserId = (req as any).user?.user_id;
      const targetUserId = req.params.userId;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      if (currentUserId === targetUserId) {
        return res.status(400).json({
          success: false,
          message: '자기 자신을 팔로우할 수 없습니다.',
        });
      }

      // 이미 팔로우 중인지 확인
      const existingRelationshipResult = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM relationships 
         WHERE follower_id = $1 AND following_id = $2`,
        [currentUserId, targetUserId],
      );
      const existingRelationshipCount = parseInt(existingRelationshipResult[0]?.count || '0', 10);

      if (existingRelationshipCount > 0) {
        return res.status(409).json({
          success: false,
          message: '이미 팔로우 중입니다.',
        });
      }

      // 팔로우 관계 생성 (원시 SQL 쿼리 사용 - id 컬럼이 없으므로)
      await AppDataSource.query(
        `INSERT INTO relationships (follower_id, following_id, is_notification_enabled, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [currentUserId, targetUserId, true],
      );

      // 타이틀 체크 및 알림 생성 (비동기 처리) - 팔로우 받은 사용자의 팔로워 수 체크
      TitleService.checkTitleOnFollowerChange(targetUserId).catch((error: any) => {
        console.error('❌ [타이틀 체크] 팔로우 후 타이틀 체크 오류:', error);
      });

      // 알림 생성 (팔로우 받은 사용자에게)
      NotificationController.createNotification(
        targetUserId,
        currentUserId,
        'NEW_FOLLOW',
        undefined,
      ).catch((error: any) => {
        console.error('❌ [알림 생성] 팔로우 알림 생성 오류:', error);
      });

      return res.json({
        success: true,
        message: '팔로우했습니다.',
      });
    } catch (error) {
      console.error('팔로우 오류:', error);
      return res.status(500).json({
        success: false,
        message: '팔로우 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 유저 언팔로우
   * DELETE /api/users/:userId/follow
   */
  static async unfollowUser(req: Request, res: Response) {
    try {
      const currentUserId = (req as any).user?.user_id;
      const targetUserId = req.params.userId;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      // 팔로우 관계 삭제
      const result = await AppDataSource.getRepository(Relationship)
        .createQueryBuilder()
        .delete()
        .where('follower_id = :followerId', {followerId: currentUserId})
        .andWhere('following_id = :followingId', {followingId: targetUserId})
        .execute();

      if (result.affected === 0) {
        return res.status(404).json({
          success: false,
          message: '팔로우 관계를 찾을 수 없습니다.',
        });
      }

      // 타이틀 체크 (비동기 처리) - 언팔로우 당한 사용자의 팔로워 수 체크
      // 참고: 언팔로우 시에는 타이틀을 회수하지 않음 (이미 획득한 타이틀은 유지)
      TitleService.checkTitleOnFollowerChange(targetUserId).catch((error: any) => {
        console.error('❌ [타이틀 체크] 언팔로우 후 타이틀 체크 오류:', error);
      });

      return res.json({
        success: true,
        message: '언팔로우했습니다.',
      });
    } catch (error) {
      console.error('언팔로우 오류:', error);
      return res.status(500).json({
        success: false,
        message: '언팔로우 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 팔로워 리스트 조회 (나를 팔로우하는 사람들)
   * GET /api/users/me/followers
   */
  static async getMyFollowers(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 팔로워 리스트 조회 (원시 SQL 쿼리 사용)
      const relationships = await AppDataSource.query(
        `SELECT 
          u.user_id,
          u.nickname,
          u.profile_image_url,
          u.introduction,
          r.created_at
         FROM relationships r
         INNER JOIN users u ON u.user_id = r.follower_id
         WHERE r.following_id = $1
         AND u.delete_yn = false
         ORDER BY r.created_at DESC`,
        [userId],
      );

      const formatted = relationships.map((rel: any) => ({
        user_id: rel.user_id,
        nickname: rel.nickname,
        profile_image_url: rel.profile_image_url || null,
        introduction: rel.introduction || null,
        created_at: rel.created_at,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('팔로워 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '팔로워 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 팔로잉 리스트 조회 (내가 팔로우하는 사람들)
   * GET /api/users/me/following
   */
  static async getMyFollowing(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 팔로잉 리스트 조회 (원시 SQL 쿼리 사용)
      const relationships = await AppDataSource.query(
        `SELECT 
          u.user_id,
          u.nickname,
          u.profile_image_url,
          u.introduction,
          r.created_at
         FROM relationships r
         INNER JOIN users u ON u.user_id = r.following_id
         WHERE r.follower_id = $1
         AND u.delete_yn = false
         ORDER BY r.created_at DESC`,
        [userId],
      );

      const formatted = relationships.map((rel: any) => ({
        user_id: rel.user_id,
        nickname: rel.nickname,
        profile_image_url: rel.profile_image_url || null,
        introduction: rel.introduction || null,
        created_at: rel.created_at,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('팔로잉 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '팔로잉 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 특정 유저의 팔로워 리스트 조회 (해당 유저를 팔로우하는 사람들)
   * GET /api/users/:userId/followers
   */
  static async getUserFollowers(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;
      const currentUserId = (req as any).user?.user_id;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      // 팔로워 리스트 조회 (원시 SQL 쿼리 사용)
      const relationships = await AppDataSource.query(
        `SELECT 
          u.user_id,
          u.nickname,
          u.profile_image_url,
          u.introduction,
          r.created_at
         FROM relationships r
         INNER JOIN users u ON u.user_id = r.follower_id
         WHERE r.following_id = $1
         AND u.delete_yn = false
         ORDER BY r.created_at DESC`,
        [targetUserId],
      );

      // 현재 사용자가 각 팔로워를 팔로우하는지 확인
      let isFollowingMap: {[key: string]: boolean} = {};
      if (currentUserId && relationships.length > 0) {
        const followerIds = relationships.map((rel: any) => rel.user_id);
        const followingRelations = await AppDataSource.query(
          `SELECT following_id FROM relationships 
           WHERE follower_id = $1 AND following_id = ANY($2::uuid[])`,
          [currentUserId, followerIds],
        );
        followingRelations.forEach((rel: any) => {
          isFollowingMap[rel.following_id] = true;
        });
      }

      const formatted = relationships.map((rel: any) => ({
        user_id: rel.user_id,
        nickname: rel.nickname,
        profile_image_url: rel.profile_image_url || null,
        introduction: rel.introduction || null,
        created_at: rel.created_at,
        isFollowing: isFollowingMap[rel.user_id] || false,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('팔로워 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '팔로워 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 특정 유저의 팔로잉 리스트 조회 (해당 유저가 팔로우하는 사람들)
   * GET /api/users/:userId/following
   */
  static async getUserFollowing(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      // 팔로잉 리스트 조회 (원시 SQL 쿼리 사용)
      const relationships = await AppDataSource.query(
        `SELECT 
          u.user_id,
          u.nickname,
          u.profile_image_url,
          u.introduction,
          r.created_at
         FROM relationships r
         INNER JOIN users u ON u.user_id = r.following_id
         WHERE r.follower_id = $1
         AND u.delete_yn = false
         ORDER BY r.created_at DESC`,
        [targetUserId],
      );

      const formatted = relationships.map((rel: any) => ({
        user_id: rel.user_id,
        nickname: rel.nickname,
        profile_image_url: rel.profile_image_url || null,
        introduction: rel.introduction || null,
        created_at: rel.created_at,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('팔로잉 리스트 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '팔로잉 리스트 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 프로필 수정
   * PUT /api/users/me
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {
        nickname,
        introduction,
        location_text,
        latitude,
        longitude,
        profile_image_url,
        view_mode,
      } = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId, delete_yn: false},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // 닉네임 중복 확인 (nickname이 제공되고 변경되는 경우)
      if (nickname && nickname !== user.nickname) {
        const existingUser = await userRepository.findOne({
          where: {nickname, delete_yn: false},
        });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: '이미 사용 중인 닉네임입니다.',
          });
        }
      }

      // 프로필 정보 업데이트
      if (nickname !== undefined) {
        user.nickname = nickname;
      }
      if (introduction !== undefined) {
        user.introduction = introduction || null;
      }
      if (location_text !== undefined) {
        user.location_text = location_text || null;
      }
      if (latitude !== undefined && longitude !== undefined) {
        user.location = {
          type: 'Point',
          coordinates: [Number(longitude), Number(latitude)],
        } as any;
      }
      if (profile_image_url !== undefined) {
        // S3 URL을 상대 경로로 변환하여 저장
        user.profile_image_url = normalizeToRelativePath(profile_image_url);
      }
      if (view_mode !== undefined) {
        user.view_mode = view_mode !== null && view_mode !== undefined ? Number(view_mode) : undefined;
      }

      await userRepository.save(user);

      return res.json({
        success: true,
        message: '프로필이 수정되었습니다.',
      });
    } catch (error) {
      console.error('프로필 수정 오류:', error);
      return res.status(500).json({
        success: false,
        message: '프로필 수정 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * FCM 토큰 저장/업데이트
   * POST /api/users/fcm-token
   */
  static async updateFcmToken(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {fcm_token} = req.body;

      if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'FCM 토큰이 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId, delete_yn: false},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // FCM 토큰 업데이트
      const trimmedToken = fcm_token.trim();
      user.fcm_token = trimmedToken;
      await userRepository.save(user);

      console.log(`✅ [FCM] 사용자 ${userId}의 FCM 토큰이 업데이트되었습니다.`);
      console.log(`📱 [FCM] 토큰 (처음 20자): ${trimmedToken.substring(0, 20)}...`);
      console.log(`📱 [FCM] 토큰 길이: ${trimmedToken.length}`);

      return res.json({
        success: true,
        message: 'FCM 토큰이 저장되었습니다.',
      });
    } catch (error) {
      console.error('FCM 토큰 저장 오류:', error);
      return res.status(500).json({
        success: false,
        message: 'FCM 토큰 저장 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * FCM 토큰 삭제 (로그아웃 시)
   * DELETE /api/users/fcm-token
   */
  static async deleteFcmToken(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId, delete_yn: false},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        });
      }

      // FCM 토큰 삭제
      user.fcm_token = null;
      await userRepository.save(user);

      console.log(`✅ [FCM] 사용자 ${userId}의 FCM 토큰이 삭제되었습니다.`);

      return res.json({
        success: true,
        message: 'FCM 토큰이 삭제되었습니다.',
      });
    } catch (error) {
      console.error('FCM 토큰 삭제 오류:', error);
      return res.status(500).json({
        success: false,
        message: 'FCM 토큰 삭제 중 오류가 발생했습니다.',
      });
    }
  }
}


