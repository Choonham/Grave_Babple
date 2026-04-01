/**
 * 타이틀 획득 비즈니스 로직 서비스
 * 
 * 하이브리드 시스템:
 * - 이벤트 기반: 간단한 조건 (레시피 개수, 좋아요, 댓글, 팔로워 등)
 * - 배치 작업: 복잡한 조건 (시간 기반, 지역 랭킹 등)
 */

import {AppDataSource} from '../config/database';
import {Title, UserTitle, User} from '../models/User';
import {RecipePost, RecipeRelation, Situation, CookingMethod, MainIngredient, Ingredient} from '../models/Post';
import {Like, Comment} from '../models/Interaction';

export class TitleService {
  /**
   * 레시피 작성 후 타이틀 체크 (이벤트 기반)
   * RecipeController.createRecipe()에서 호출
   * 
   * 체크하는 타이틀:
   * - 첫 식빵! (title_id: 2): 첫 레시피 작성
   * - 신규 작가 (title_id: 18): 가입 후 7일 이내 레시피 3개 이상
   */
  static async checkTitleOnRecipeCreate(userId: string, recipeId: string) {
    try {
      console.log(`🔍 [타이틀 서비스] 레시피 작성 후 타이틀 체크 시작 (userId: ${userId}, recipeId: ${recipeId})`);
      
      // 1. 첫 레시피 작성 타이틀 (title_id: 2)
      const recipeCount = await AppDataSource.getRepository(RecipePost).count({
        where: {
          user_id: userId,
          delete_yn: false,
        },
      });

      console.log(`🔍 [타이틀 서비스] 사용자 ${userId}의 레시피 개수: ${recipeCount}`);

      if (recipeCount === 1) {
        console.log(`🔍 [타이틀 서비스] 첫 레시피 작성 타이틀 부여 시도 (title_id: 2)`);
        await this.grantTitle(userId, 2); // "첫 식빵!"
      }

      // 2. 신규 작가 타이틀 (title_id: 18): 가입 후 7일 이내 레시피 3개 이상
      const user = await AppDataSource.getRepository(User).findOne({
        where: {user_id: userId},
      });

      if (user) {
        const daysSinceJoin = Math.floor(
          (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSinceJoin <= 7 && recipeCount >= 3) {
          await this.grantTitle(userId, 18); // "신규 작가"
        }
      }

      // 3. 카테고리별 타이틀 체크
      await this.checkCategoryBasedTitles(userId);
      
      console.log(`✅ [타이틀 서비스] 레시피 작성 후 타이틀 체크 완료`);
    } catch (error) {
      console.error('❌ [타이틀 서비스] 레시피 작성 후 타이틀 체크 오류:', error);
      console.error('❌ [타이틀 서비스] 오류 상세:', (error as Error).message);
      console.error('❌ [타이틀 서비스] 오류 스택:', (error as Error).stack);
    }
  }

  /**
   * 좋아요 받았을 때 타이틀 체크 (이벤트 기반)
   * RecipeController.likeRecipe()에서 호출
   * 
   * 체크하는 타이틀:
   * - 인기 레시피 작가 (title_id: 9): 레시피에 좋아요 100개 이상
   * - 팔로잉 인기 작가 (title_id: 10): 레시피에 좋아요 500개 이상
   */
  static async checkTitleOnLikeReceived(userId: string, recipeId: string) {
    try {
      // 레시피의 총 좋아요 수 조회
      const recipe = await AppDataSource.getRepository(RecipePost).findOne({
        where: {recipe_post_id: recipeId},
        select: ['recipe_post_id', 'user_id', 'like_count'],
      });

      if (!recipe || recipe.user_id !== userId) {
        return; // 자신의 레시피가 아니면 체크하지 않음
      }

      const likeCount = recipe.like_count ?? 0;

      // 100개 이상이면 "인기 레시피 작가" (title_id: 9)
      if (likeCount >= 100) {
        await this.grantTitle(userId, 9);
      }

      // 500개 이상이면 "팔로잉 인기 작가" (title_id: 10)
      if (likeCount >= 500) {
        await this.grantTitle(userId, 10);
      }
    } catch (error) {
      console.error('❌ [타이틀 서비스] 좋아요 받음 후 타이틀 체크 오류:', error);
    }
  }

  /**
   * 좋아요를 누를 때 타이틀 체크 (이벤트 기반)
   * RecipeController.likeRecipe()에서 호출 (좋아요를 누른 사용자)
   * 
   * 체크하는 타이틀:
   * - 활발한 사용자 (title_id: 15): 좋아요를 50개 이상 누름
   */
  static async checkTitleOnLikeGiven(userId: string) {
    try {
      // 사용자가 누른 총 좋아요 수
      const likeCount = await AppDataSource.getRepository(Like).count({
        where: {user_id: userId},
      });

      // 50개 이상이면 "활발한 사용자" (title_id: 15)
      if (likeCount >= 50) {
        await this.grantTitle(userId, 15);
      }
    } catch (error) {
      console.error('❌ [타이틀 서비스] 좋아요 누름 후 타이틀 체크 오류:', error);
    }
  }

  /**
   * 댓글 받았을 때 타이틀 체크 (이벤트 기반)
   * RecipeController.createComment()에서 호출
   * 
   * 체크하는 타이틀:
   * - 댓글 왕 (title_id: 11): 레시피에 댓글 50개 이상
   */
  static async checkTitleOnCommentReceived(userId: string, recipeId: string) {
    try {
      // 레시피의 총 댓글 수 조회
      const recipe = await AppDataSource.getRepository(RecipePost).findOne({
        where: {recipe_post_id: recipeId},
        select: ['recipe_post_id', 'user_id', 'comment_count'],
      });

      if (!recipe || recipe.user_id !== userId) {
        return; // 자신의 레시피가 아니면 체크하지 않음
      }

      const commentCount = recipe.comment_count ?? 0;

      // 50개 이상이면 "댓글 왕" (title_id: 11)
      if (commentCount >= 50) {
        await this.grantTitle(userId, 11);
      }
    } catch (error) {
      console.error('❌ [타이틀 서비스] 댓글 받음 후 타이틀 체크 오류:', error);
    }
  }

  /**
   * 댓글을 작성할 때 타이틀 체크 (이벤트 기반)
   * RecipeController.createComment()에서 호출 (댓글을 작성한 사용자)
   * 
   * 체크하는 타이틀:
   * - 댓글러 (title_id: 16): 댓글을 30개 이상 작성
   */
  static async checkTitleOnCommentWritten(userId: string) {
    try {
      // 사용자가 작성한 총 댓글 수
      const commentCount = await AppDataSource.getRepository(Comment).count({
        where: {user_id: userId},
      });

      // 30개 이상이면 "댓글러" (title_id: 16)
      if (commentCount >= 30) {
        await this.grantTitle(userId, 16);
      }
    } catch (error) {
      console.error('❌ [타이틀 서비스] 댓글 작성 후 타이틀 체크 오류:', error);
    }
  }

  /**
   * 팔로워 수 변경 시 타이틀 체크 (이벤트 기반)
   * UserController.followUser() 또는 unfollowUser()에서 호출
   * 
   * 체크하는 타이틀:
   * - 팔로워 100명 (title_id: 12): 팔로워 100명 이상
   * - 팔로워 500명 (title_id: 13): 팔로워 500명 이상
   * - 팔로워 1000명 (title_id: 14): 팔로워 1000명 이상
   */
  static async checkTitleOnFollowerChange(userId: string) {
    try {
      const followerCountResult = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM relationships WHERE following_id = $1`,
        [userId],
      );
      const followerCount = parseInt(followerCountResult[0]?.count || '0', 10);

      if (followerCount >= 100) {
        await this.grantTitle(userId, 12); // "팔로워 100명"
      }
      if (followerCount >= 500) {
        await this.grantTitle(userId, 13); // "팔로워 500명"
      }
      if (followerCount >= 1000) {
        await this.grantTitle(userId, 14); // "팔로워 1000명"
      }
    } catch (error) {
      console.error('❌ [타이틀 서비스] 팔로워 변경 후 타이틀 체크 오류:', error);
    }
  }

  /**
   * 타이틀 부여 (중복 체크 포함)
   * 
   * @param userId 사용자 ID
   * @param titleId 타이틀 ID
   * @returns 타이틀 부여 성공 여부
   */
  static async grantTitle(userId: string, titleId: number): Promise<boolean> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log(`🔍 [타이틀 서비스] grantTitle 호출 (userId: ${userId}, titleId: ${titleId})`);
      
      // 타이틀 존재 여부 확인
      const titleRepository = queryRunner.manager.getRepository(Title);
      const titleExists = await titleRepository.findOne({
        where: { title_id: titleId },
      });

      if (!titleExists) {
        console.error(`❌ [타이틀 서비스] 타이틀 ${titleId}가 titles 테이블에 존재하지 않습니다.`);
        await queryRunner.rollbackTransaction();
        return false;
      }

      console.log(`✅ [타이틀 서비스] 타이틀 ${titleId} 존재 확인: ${titleExists.name}`);

      const userTitleRepository = queryRunner.manager.getRepository(UserTitle);

      // 이미 획득한 타이틀인지 확인
      const existing = await userTitleRepository.findOne({
        where: {
          user_id: userId,
          title_id: titleId,
        },
      });

      if (existing) {
        console.log(`⚠️ [타이틀 서비스] 사용자 ${userId}는 이미 타이틀 ${titleId}를 보유하고 있습니다.`);
        await queryRunner.commitTransaction();
        return false;
      }

      // 타이틀 부여
      const userTitle = userTitleRepository.create({
        user_id: userId,
        title_id: titleId,
      });
      await userTitleRepository.save(userTitle);

      console.log(`✅ [타이틀 서비스] 사용자 ${userId}가 타이틀 ${titleId} 획득`);

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();

      // TODO: 알림 발송 (필요시)
      // await NotificationService.sendTitleNotification(userId, titleId);

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`❌ [타이틀 서비스] 타이틀 부여 오류 (userId: ${userId}, titleId: ${titleId}):`, error);
      console.error(`❌ [타이틀 서비스] 오류 상세:`, (error as Error).message);
      console.error(`❌ [타이틀 서비스] 오류 스택:`, (error as Error).stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 배치 작업: 모든 사용자의 타이틀 체크
   * 복잡한 조건이나 시간 기반 타이틀을 체크할 때 사용
   * 
   * 현재는 특별한 배치 작업이 필요하지 않지만,
   * 향후 확장 가능성을 위해 구조만 제공
   */
  static async checkAllTitlesForUser(userId: string) {
    try {
      // 신규 작가 타이틀 체크 (가입 후 7일 이내 레시피 3개 이상)
      const user = await AppDataSource.getRepository(User).findOne({
        where: {user_id: userId},
      });

      if (user) {
        const daysSinceJoin = Math.floor(
          (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceJoin <= 7) {
          const recipeCount = await AppDataSource.getRepository(RecipePost).count({
            where: {
              user_id: userId,
              delete_yn: false,
            },
          });

          if (recipeCount >= 3) {
            await this.grantTitle(userId, 18); // "신규 작가"
          }
        }
      }

      // 카테고리별 타이틀 체크
      await this.checkCategoryBasedTitles(userId);

      // TODO: 향후 추가할 배치 작업 타이틀들
      // - 지역 랭킹 타이틀 (title_id: 17): 지역 랭킹에 3회 이상 등록
    } catch (error) {
      console.error(`❌ [타이틀 서비스] 사용자 ${userId} 타이틀 체크 오류:`, error);
    }
  }

  /**
   * 카테고리별 레시피 개수 조회
   * 
   * @param userId 사용자 ID
   * @param categoryType 카테고리 타입 (0: Situation, 1: CookingMethod, 2: MainIngredient)
   * @param categoryName 카테고리 이름 (예: "빵", "계란", "한식", "디저트")
   * @returns 해당 카테고리의 레시피 개수
   */
  private static async countRecipesByCategory(
    userId: string,
    categoryType: number,
    categoryName: string,
  ): Promise<number> {
    try {
      // 카테고리 이름으로 ID 찾기
      let categoryId: number | null = null;

      if (categoryType === 0) {
        // Situation
        const situation = await AppDataSource.getRepository(Situation).findOne({
          where: {name: categoryName},
        });
        categoryId = situation?.situation_id || null;
      } else if (categoryType === 1) {
        // CookingMethod
        const cookingMethod = await AppDataSource.getRepository(CookingMethod).findOne({
          where: {name: categoryName},
        });
        categoryId = cookingMethod?.method_id || null;
      } else if (categoryType === 2) {
        // MainIngredient - Ingredient 이름으로 검색
        const ingredient = await AppDataSource.getRepository(Ingredient).findOne({
          where: {name: categoryName},
        });
        if (ingredient) {
          const mainIngredient = await AppDataSource.getRepository(MainIngredient).findOne({
            where: {ingredient_id: ingredient.ingredient_id},
          });
          categoryId = mainIngredient?.main_ingredient_id || null;
        }
      }

      if (!categoryId) {
        return 0; // 카테고리를 찾을 수 없음
      }

      // 해당 카테고리를 사용한 레시피 개수 조회
      // RecipeRelation과 RecipePost를 직접 조인
      const count = await AppDataSource.getRepository(RecipeRelation)
        .createQueryBuilder('rr')
        .innerJoin(RecipePost, 'recipe', 'recipe.recipe_post_id = rr.recipe_post_id')
        .where('recipe.user_id = :userId', {userId})
        .andWhere('recipe.delete_yn = false')
        .andWhere('rr.type = :type', {type: categoryType})
        .andWhere('rr.child_id = :categoryId', {categoryId})
        .getCount();

      return count;
    } catch (error) {
      console.error(`❌ [타이틀 서비스] 카테고리별 레시피 개수 조회 오류 (categoryType: ${categoryType}, categoryName: ${categoryName}):`, error);
      return 0;
    }
  }

  /**
   * 카테고리별 타이틀 체크
   * 레시피 작성 후 호출되어 카테고리별 타이틀을 체크
   */
  private static async checkCategoryBasedTitles(userId: string) {
    try {
      // 1. 재빵 마스터 (title_id: 1): 빵 레시피 10개 이상
      const breadCount = await this.countRecipesByCategory(userId, 2, '빵');
      if (breadCount >= 10) {
        await this.grantTitle(userId, 1);
      }

      // 2. 타코벨 직원 (title_id: 3): 멕시칸 요리 레시피 5개 이상
      const mexicanCount = await this.countRecipesByCategory(userId, 0, '멕시칸');
      if (mexicanCount >= 5) {
        await this.grantTitle(userId, 3);
      }

      // 3. 란계 마스터 (title_id: 4): 계란 요리 레시피 10개 이상
      const eggCount = await this.countRecipesByCategory(userId, 2, '계란');
      if (eggCount >= 10) {
        await this.grantTitle(userId, 4);
      }

      // 4. 국시집 사장님 (title_id: 5): 국수 레시피 8개 이상
      const noodleCount = await this.countRecipesByCategory(userId, 2, '국수');
      if (noodleCount >= 8) {
        await this.grantTitle(userId, 5);
      }

      // 5. 김밥 마스터 (title_id: 6): 김밥 레시피 5개 이상
      const kimbapCount = await this.countRecipesByCategory(userId, 2, '김밥');
      if (kimbapCount >= 5) {
        await this.grantTitle(userId, 6);
      }

      // 6. 디저트 전문가 (title_id: 7): 디저트 레시피 15개 이상
      const dessertCount = await this.countRecipesByCategory(userId, 0, '디저트');
      if (dessertCount >= 15) {
        await this.grantTitle(userId, 7);
      }

      // 7. 한식 요리사 (title_id: 8): 한식 레시피 20개 이상
      const koreanCount = await this.countRecipesByCategory(userId, 0, '한식');
      if (koreanCount >= 20) {
        await this.grantTitle(userId, 8);
      }
    } catch (error) {
      console.error('❌ [타이틀 서비스] 카테고리별 타이틀 체크 오류:', error);
    }
  }
}

