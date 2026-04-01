import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {User} from '../models/User';
import {RecipePost} from '../models/Post';
import {AdCreative, Advertiser, AdCampaign} from '../models/Store';
import {Like} from 'typeorm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * 관리자 컨트롤러
 */
export class AdminController {
  /**
   * 관리자 로그인
   * POST /api/admin/login
   */
  static async login(req: Request, res: Response) {
    try {
      const {email, password} = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: '이메일과 비밀번호를 입력해주세요.',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {email, delete_yn: false},
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      // 관리자 권한 확인 (role 9)
      const userRole = typeof user.role === 'string' ? parseInt(user.role, 10) : user.role;
      if (userRole !== 9) {
        return res.status(403).json({
          success: false,
          message: '관리자 권한이 없습니다.',
        });
      }

      // 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password_hash || '');
      if (!isPasswordValid) {
        console.log('❌ [관리자 로그인] 비밀번호 불일치');
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      // JWT 토큰 생성
      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
        },
        jwtSecret,
        {expiresIn: '24h'},
      );

      return res.json({
        success: true,
        data: {
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            nickname: user.nickname,
            role: user.role,
          },
        },
      });
    } catch (error) {
      console.error('❌ [관리자 로그인] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '로그인 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 유저 목록 조회
   * GET /api/admin/users
   */
  static async getUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const keyword = (req.query.keyword as string) || '';
      const skip = (page - 1) * limit;

      const userRepository = AppDataSource.getRepository(User);
      
      // 총 개수 조회 (별도 쿼리)
      const countQueryBuilder = userRepository.createQueryBuilder('user');
      if (keyword) {
        countQueryBuilder.where(
          '(LOWER(user.nickname) LIKE LOWER(:keyword) OR LOWER(user.email) LIKE LOWER(:keyword))',
          {keyword: `%${keyword}%`},
        );
      }
      const total = await countQueryBuilder.getCount();

      // 데이터 조회 (raw query로 status 및 account_type 포함)
      const queryBuilder = userRepository.createQueryBuilder('user');
      if (keyword) {
        queryBuilder.where(
          '(LOWER(user.nickname) LIKE LOWER(:keyword) OR LOWER(user.email) LIKE LOWER(:keyword))',
          {keyword: `%${keyword}%`},
        );
      }

      // 모든 필드를 raw query로 가져오기 (status 필드 포함)
      const rawUsers = await queryBuilder
        .addSelect('"user"."status"', 'user_status')
        .orderBy('user.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getRawMany();

      return res.json({
        success: true,
        data: {
          users: rawUsers.map((row: any) => {
            const userRole = row.user_role;
            // 비즈니스 계정(role 1, 2)은 기본값 PENDING, 일반 계정은 ACTIVE
            const defaultStatus = (userRole === 1 || userRole === 2) ? 'PENDING' : 'ACTIVE';
            // raw query 결과에서 status 가져오기
            const rawStatus = row.user_status;
            // status가 null, undefined, 빈 문자열이면 기본값 사용, 아니면 실제 status 사용
            const finalStatus = (rawStatus === null || rawStatus === undefined || rawStatus === '') 
              ? defaultStatus 
              : rawStatus;
            
            // account_type은 role로부터 유추 (1: 상점, 2: 광고주)
            let accountType = null;
            if (userRole === 1) {
              accountType = 'store';
            } else if (userRole === 2) {
              accountType = 'advertiser';
            }
            
            return {
              user_id: row.user_user_id,
              email: row.user_email,
              nickname: row.user_nickname,
              profile_image_url: row.user_profile_image_url,
              role: userRole,
              account_type: accountType, // role에서 유추: 1=store, 2=advertiser
              status: finalStatus,
              created_at: row.user_created_at,
              delete_yn: row.user_delete_yn,
            };
          }),
          total,
          page,
          limit,
        },
      });
    } catch (error) {
      console.error('❌ [관리자 유저 목록] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '유저 목록 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 유저 제재
   * POST /api/admin/users/:userId/ban
   */
  static async banUser(req: Request, res: Response) {
    try {
      const {userId} = req.params;
      const {reason} = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '유저를 찾을 수 없습니다.',
        });
      }

      // delete_yn을 true로 설정 (제재)
      user.delete_yn = true;
      await userRepository.save(user);

      return res.json({
        success: true,
        message: '유저가 제재되었습니다.',
      });
    } catch (error) {
      console.error('❌ [유저 제재] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '유저 제재 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 유저 제재 해제
   * POST /api/admin/users/:userId/unban
   */
  static async unbanUser(req: Request, res: Response) {
    try {
      const {userId} = req.params;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '유저를 찾을 수 없습니다.',
        });
      }

      // delete_yn을 false로 설정 (제재 해제)
      user.delete_yn = false;
      await userRepository.save(user);

      return res.json({
        success: true,
        message: '제재가 해제되었습니다.',
      });
    } catch (error) {
      console.error('❌ [유저 제재 해제] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '제재 해제 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 게시글 목록 조회
   * GET /api/admin/recipes
   */
  static async getRecipes(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const keyword = (req.query.keyword as string) || '';
      const skip = (page - 1) * limit;

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const queryBuilder = recipeRepository
        .createQueryBuilder('recipe')
        .leftJoinAndSelect('recipe.user', 'user');

      if (keyword) {
        queryBuilder.where('LOWER(recipe.title) LIKE LOWER(:keyword)', {keyword: `%${keyword}%`});
      }

      const [recipes, total] = await queryBuilder
        .orderBy('recipe.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return res.json({
        success: true,
        data: {
          recipes: recipes.map(recipe => ({
            recipe_post_id: recipe.recipe_post_id,
            title: recipe.title,
            description: recipe.description,
            user: {
              user_id: recipe.user?.user_id,
              nickname: recipe.user?.nickname || '이웃',
            },
            like_count: recipe.like_count || 0,
            comment_count: recipe.comment_count || 0,
            created_at: recipe.created_at,
            delete_yn: recipe.delete_yn,
          })),
          total,
          page,
          limit,
        },
      });
    } catch (error) {
      console.error('❌ [관리자 게시글 목록] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '게시글 목록 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 게시글 삭제
   * DELETE /api/admin/recipes/:recipeId
   */
  static async deleteRecipe(req: Request, res: Response) {
    try {
      const {recipeId} = req.params;

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipe = await recipeRepository.findOne({
        where: {recipe_post_id: recipeId},
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '게시글을 찾을 수 없습니다.',
        });
      }

      recipe.delete_yn = true;
      await recipeRepository.save(recipe);

      return res.json({
        success: true,
        message: '게시글이 삭제되었습니다.',
      });
    } catch (error) {
      console.error('❌ [게시글 삭제] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '게시글 삭제 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 유저 상태 변경
   * PUT /api/admin/users/:userId/status
   */
  static async updateUserStatus(req: Request, res: Response) {
    try {
      const {userId} = req.params;
      const {status} = req.body;

      if (!status || !['ACTIVE', 'PENDING', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '유효한 상태값이 필요합니다. (ACTIVE, PENDING, SUSPENDED)',
        });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {user_id: userId},
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '유저를 찾을 수 없습니다.',
        });
      }

      // status 필드가 엔티티에 정의되지 않았으므로 raw SQL로 직접 업데이트
      await userRepository.query(
        'UPDATE users SET status = $1 WHERE user_id = $2',
        [status, userId]
      );

      return res.json({
        success: true,
        message: `유저 상태가 ${status}로 변경되었습니다.`,
      });
    } catch (error) {
      console.error('❌ [유저 상태 변경] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '유저 상태 변경 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 광고 캠페인 목록 조회
   * GET /api/admin/ads
   */
  static async getAds(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = (req.query.status as string) || '';
      const skip = (page - 1) * limit;

      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const queryBuilder = campaignRepository
        .createQueryBuilder('campaign')
        .leftJoinAndSelect('campaign.advertiser', 'advertiser');

      if (status) {
        queryBuilder.where('campaign.status = :status', {status});
      }

      const [campaigns, total] = await queryBuilder
        .orderBy('campaign.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return res.json({
        success: true,
        data: {
          ads: campaigns.map(campaign => ({
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            advertiser: {
              advertiser_id: campaign.advertiser?.advertiser_id,
              biz_name: campaign.advertiser?.biz_name || '',
            },
            status: campaign.status || 'PENDING',
            total_budget: campaign.total_budget,
            cpi: campaign.cpi,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            view_count: campaign.view_count,
            click_count: campaign.click_count,
            created_at: campaign.created_at,
            delete_yn: campaign.delete_yn,
          })),
          total,
          page,
          limit,
        },
      });
    } catch (error) {
      console.error('❌ [관리자 광고 목록] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '광고 목록 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 광고 캠페인 승인
   * POST /api/admin/ads/:campaignId/approve
   */
  static async approveAd(req: Request, res: Response) {
    try {
      const {campaignId} = req.params;

      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {campaign_id: campaignId},
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '광고 캠페인을 찾을 수 없습니다.',
        });
      }

      campaign.status = 'ACTIVE';
      await campaignRepository.save(campaign);

      return res.json({
        success: true,
        message: '광고 캠페인이 승인되었습니다.',
      });
    } catch (error) {
      console.error('❌ [광고 승인] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '광고 승인 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 광고 캠페인 거부
   * POST /api/admin/ads/:campaignId/reject
   */
  static async rejectAd(req: Request, res: Response) {
    try {
      const {campaignId} = req.params;
      const {reason} = req.body;

      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {campaign_id: campaignId},
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '광고 캠페인을 찾을 수 없습니다.',
        });
      }

      // 거부 시 상태를 변경하지 않고 PENDING으로 유지
      // 사용자가 수정 후 다시 제출할 수 있도록 함
      // 상태는 PENDING으로 유지되고 거부 사유는 메시지로 전달됨

      return res.json({
        success: true,
        message: `광고 캠페인이 거부되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      });
    } catch (error) {
      console.error('❌ [광고 거부] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '광고 거부 중 오류가 발생했습니다.',
      });
    }
  }
}

