import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import {
  RecipePost,
  RecipePostImage,
  RecipeIngredient,
  RecipeStep,
  RecipeRelation,
  Situation,
  CookingMethod,
  MainIngredient,
  Ingredient,
} from '../models/Post';
import { User } from '../models/User';
import { Like, Comment } from '../models/Interaction';
import { HiddenUser } from '../models/Report';
import { TitleService } from '../services/TitleService';
import { NotificationController } from './NotificationController';
import { s3Service } from '../services/S3Service';
import { normalizeImageUrl, normalizeImageUrlsInObject, getThumbnailUrl } from '../utils/imageUrl';
import { resizeAndCreateThumbnail } from '../utils/imageProcessor';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { Brackets, IsNull } from 'typeorm';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import https from 'https';
import axios from 'axios';
import sharp from 'sharp';

/**
 * 레시피 컨트롤러
 * 레시피 관련 모든 기능을 담당
 */
export class RecipeController {
  /**
   * AI 응답 검증: 환각(Hallucination) 및 안전성 체크
   * @param analysisResult AI 분석 결과
   * @param recipeName 사용자가 입력한 요리 이름 (선택)
   * @param mainIngredients 사용자가 선택한 주재료 목록 (선택)
   * @returns 검증 결과
   */
  private static validateAIResponse(
    analysisResult: any,
    recipeName?: string,
    mainIngredients: string[] = []
  ): { valid: boolean; errors: string[]; message?: string } {
    const errors: string[] = [];

    // 1. 위험한 재료/조리법 체크
    const dangerousPatterns = [
      // 감자 싹 관련
      { pattern: /감자\s*싹|감자\s*눈|감자\s*껍질.*녹색|녹색.*감자/i, message: '감자 싹이나 녹색 감자는 독성이 있어 사용할 수 없습니다.' },
      // 생고기 관련
      { pattern: /닭고기.*생|생.*닭고기|닭고기.*회|회.*닭고기/i, message: '닭고기는 반드시 충분히 익혀야 합니다.' },
      { pattern: /돼지고기.*생|생.*돼지고기|돼지고기.*회|회.*돼지고기/i, message: '돼지고기는 반드시 충분히 익혀야 합니다.' },
      { pattern: /생고기|고기.*회|회.*고기/i, message: '고기는 반드시 충분히 익혀야 합니다.' },
      // 기타 위험한 조리법
      { pattern: /독성|유독|위험.*재료/i, message: '위험한 재료나 조리법은 사용할 수 없습니다.' },
    ];

    // 레시피 단계에서 위험한 패턴 검사
    const allInstructions = [
      ...(analysisResult.recipe_steps || []).map((step: any) => step.instruction || ''),
      analysisResult.description || '',
      analysisResult.title || '',
    ].join(' ');

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(allInstructions)) {
        errors.push(message);
      }
    }

    // 재료 목록에서도 위험한 재료 검사
    const allIngredientNames = (analysisResult.ingredients || [])
      .map((ing: any) => ing.name || '')
      .join(' ');

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(allIngredientNames)) {
        errors.push(message);
      }
    }

    // 2. 없는 재료 창조 방지 (이미지에 없는 재료를 레시피에 넣지 않도록)
    // 주의: 이 검증은 완벽하지 않을 수 있지만, 명백히 이미지에 있을 수 없는 고급 재료를 필터링
    const luxuryIngredients = [
      '트러플', '트러플 오일', '캐비어', '푸아그라', '와규', '한우', '송로버섯',
      '샤프란', '바닐라 빈', '바닐라 콩', '시나몬 스틱', '계피 스틱',
    ];

    const detectedLuxuryIngredients: string[] = [];
    for (const ing of analysisResult.ingredients || []) {
      const ingredientName = (ing.name || '').toLowerCase();
      for (const luxury of luxuryIngredients) {
        if (ingredientName.includes(luxury.toLowerCase())) {
          detectedLuxuryIngredients.push(ing.name);
        }
      }
    }

    // 사용자가 입력한 요리 이름이나 주재료가 고급 요리가 아닌데 고급 재료가 포함된 경우 경고
    if (detectedLuxuryIngredients.length > 0) {
      const isLuxuryRecipe = recipeName && (
        recipeName.includes('트러플') || recipeName.includes('캐비어') ||
        recipeName.includes('와규') || recipeName.includes('한우')
      );

      if (!isLuxuryRecipe) {
        errors.push(`이미지에서 확인할 수 없는 고급 재료가 포함되어 있습니다: ${detectedLuxuryIngredients.join(', ')}. 이미지에 실제로 보이는 재료만 사용해주세요.`);
      }
    }

    // 3. 기본 검증: 필수 필드 존재 여부
    if (!analysisResult.title || !analysisResult.title.trim()) {
      errors.push('요리 이름이 없습니다.');
    }
    if (!analysisResult.ingredients || !Array.isArray(analysisResult.ingredients) || analysisResult.ingredients.length === 0) {
      errors.push('재료 정보가 없습니다.');
    }
    if (!analysisResult.recipe_steps || !Array.isArray(analysisResult.recipe_steps) || analysisResult.recipe_steps.length === 0) {
      errors.push('레시피 단계가 없습니다.');
    }

    // 4. 사용자가 선택한 주재료가 레시피에 포함되어 있는지 검증
    if (mainIngredients.length > 0) {
      const ingredientNamesInRecipe = (analysisResult.ingredients || [])
        .map((ing: any) => (ing.name || '').toLowerCase().trim())
        .join(' ');

      const missingMainIngredients: string[] = [];
      for (const mainIngredient of mainIngredients) {
        const mainIngredientLower = mainIngredient.toLowerCase().trim();

        // 주재료가 레시피 재료 목록에 포함되어 있는지 확인
        // 부분 일치도 허용 (예: "돼지고기" 선택 시 "삼겹살", "목살" 등도 허용)
        const isIncluded = ingredientNamesInRecipe.includes(mainIngredientLower);

        if (!isIncluded) {
          missingMainIngredients.push(mainIngredient);
        }
      }

      if (missingMainIngredients.length > 0) {
        errors.push(`사용자가 선택한 주재료가 레시피에 포함되어 있지 않습니다: ${missingMainIngredients.join(', ')}. 선택한 주재료는 반드시 레시피에 포함되어야 합니다.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      message: errors.length > 0 ? errors.join(' ') : undefined,
    };
  }

  private static getUserIdFromRequest(req: Request): string | null {
    const user = (req as any).user;
    if (user?.user_id) {
      return user.user_id;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return null;
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-babple-development';
      const decoded = jwt.verify(token, jwtSecret) as any;
      return decoded?.user_id || null;
    } catch (error) {
      console.warn('⚠️ [RecipeController] 토큰 파싱 실패:', error);
      return null;
    }
  }

  private static formatComment(comment: Comment): any {
    return {
      comment_id: comment.comment_id,
      parent_comment_id: comment.parent_comment_id ?? null,
      content: comment.content,
      created_at: comment.created_at,
      user: comment.user
        ? {
          user_id: comment.user.user_id,
          nickname: comment.user.nickname,
          profile_image_url: normalizeImageUrl(comment.user.profile_image_url),
        }
        : {
          nickname: '이웃',
        },
      sub_comments: [] as any[],
    };
  }

  private static buildCommentTree(comments: Comment[]): any[] {
    const formatted = comments.map(comment => RecipeController.formatComment(comment));
    const commentMap = new Map<string, any>();
    formatted.forEach(comment => {
      comment.sub_comments = comment.sub_comments || [];
      commentMap.set(comment.comment_id, comment);
    });

    const roots: any[] = [];
    formatted.forEach(comment => {
      if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
        const parent = commentMap.get(comment.parent_comment_id);
        parent.sub_comments = parent.sub_comments || [];
        parent.sub_comments.push(comment);
      } else {
        roots.push(comment);
      }
    });

    return roots;
  }

  /**
   * 레시피 카테고리 조회
   * GET /api/recipes/categories
   */
  static async getCategories(req: Request, res: Response) {
    try {
      const situationRepository = AppDataSource.getRepository(Situation);
      const cookingMethodRepository = AppDataSource.getRepository(CookingMethod);
      const mainIngredientRepository = AppDataSource.getRepository(MainIngredient);

      // 모든 카테고리 조회
      const [situations, cookingMethods, mainIngredients] = await Promise.all([
        situationRepository.find({ order: { situation_id: 'ASC' } }),
        cookingMethodRepository.find({ order: { method_id: 'ASC' } }),
        mainIngredientRepository.find({
          relations: ['ingredient'],
          order: { main_ingredient_id: 'ASC' },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          situation: situations.map(s => ({
            situation_id: s.situation_id,
            name: s.name,
          })),
          cooking_method: cookingMethods.map(c => ({
            method_id: c.method_id,
            name: c.name,
          })),
          main_ingredient: mainIngredients.map(m => ({
            main_ingredient_id: m.main_ingredient_id,
            ingredient_id: m.ingredient_id,
            name: m.ingredient?.name || '',
            default_unit: m.ingredient?.default_unit || '',
          })),
        },
      });
    } catch (error) {
      console.error('카테고리 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 추천 레시피 리스트 조회
   * GET /api/recipes/recommendations
   * main_ingredient_id만 고려하여 추천 레시피를 반환합니다.
   * search 파라미터가 있으면 모든 추천 레시피에서 검색합니다.
   */
  static async getRecommendations(req: Request, res: Response) {
    try {
      const { main_ingredient_id, search } = req.query;
      const searchQuery = search ? String(search).trim() : '';

      const recipeRepository = AppDataSource.getRepository(RecipePost);

      let query = recipeRepository
        .createQueryBuilder('recipe')
        .leftJoinAndSelect('recipe.user', 'user')
        .leftJoinAndSelect('recipe.images', 'images')
        .where('recipe.delete_yn = :deleteYn', { deleteYn: false })
        .andWhere('recipe.is_default = :isDefault', { isDefault: true })
        .orderBy('recipe.created_at', 'DESC')
        .limit(50); // 검색 시 더 많은 결과를 반환하기 위해 limit 증가

      // 검색어가 있는 경우: 모든 추천 레시피에서 제목으로 검색
      if (searchQuery) {
        query = query.andWhere('recipe.title ILIKE :search', {
          search: `%${searchQuery}%`,
        });
      } else {
        // 검색어가 없으면 main_ingredient_id로 필터링
        // main_ingredient_id만 필터링 - 각 타입별로 별도의 relation 레코드가 있으므로 EXISTS 절 사용
        if (main_ingredient_id) {
          query = query.andWhere(
            `EXISTS (
              SELECT 1 FROM recipe_relations rr 
              WHERE rr.recipe_post_id = recipe.recipe_post_id 
              AND rr.type = 2 
              AND rr.child_id = :mainIngredientId
            )`,
            { mainIngredientId: main_ingredient_id }
          );
        }
      }

      const recipes = await query.getMany();

      const formattedRecipes = recipes.map(recipe => ({
        recipe_post_id: recipe.recipe_post_id,
        id: recipe.recipe_post_id,
        title: recipe.title,
        name: recipe.title,
        images: recipe.images?.map(img => normalizeImageUrl(img.image_url)) || [],
        represent_photo_url: normalizeImageUrl(recipe.images?.[0]?.image_url) || null,
      }));

      return res.json({
        success: true,
        data: formattedRecipes,
      });
    } catch (error) {
      console.error('추천 레시피 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 인기 레시피 랭킹 조회
   * GET /api/recipes/local-ranking
   * 
   * 🚧 릴리즈에서 변경: 현재는 알파 테스트 기간으로 모든 레시피 표시
   * 
   * [릴리즈 시 구 단위 매칭 로직]
   * location_text 예시: "인천 연수구 청학동"
   * - 공백으로 split하여 2번째 인덱스 (구 정보) 추출
   * - 같은 구에 있는 레시피들을 좋아요 순으로 정렬
   */
  static async getLocalRanking(req: Request, res: Response) {
    try {
      const userId = RecipeController.getUserIdFromRequest(req);
      const locationText = req.query.location_text as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 10, 30);

      // 🚧 릴리즈에서 변경: 아래 주석을 해제하여 구 단위 매칭 활성화
      /*
      // location_text가 없으면 userId로 조회
      if (!locationText || !locationText.trim()) {
        if (!userId) {
          return res.json({
            success: true,
            data: [],
          });
        }

        const userInfo = await AppDataSource.getRepository(User).findOne({
          where: {user_id: userId, delete_yn: false},
          select: ['location_text'],
        });

        if (!userInfo || !userInfo.location_text) {
          return res.json({
            success: true,
            data: [],
          });
        }

        locationText = userInfo.location_text;
      }

      // location_text에서 구 정보 추출
      // 예: "인천 연수구 청학동" → ["인천", "연수구", "청학동"]
      const locationParts = locationText.trim().split(/\s+/);
      
      // 2번째 인덱스가 구 정보 (인덱스 1)
      const district = locationParts.length >= 2 ? locationParts[1] : null;

      if (!district) {
        console.warn('⚠️ [RecipeController] 구 정보를 추출할 수 없습니다:', locationText);
        return res.json({
          success: true,
          data: [],
        });
      }

      console.log(`📍 [RecipeController] 지역 인기 레시피 조회 - 구: ${district}`);
      */

      // 🚧 알파 테스트 기간: 모든 레시피를 좋아요 순으로 표시
      console.log(`📍 [RecipeController] 인기 레시피 조회 (알파 테스트 - 전체)`);

      // 모든 레시피 조회 (주소 조건 없음)
      const ranking = await AppDataSource.getRepository(RecipePost)
        .createQueryBuilder('recipe')
        .leftJoin('recipe.user', 'user')
        .leftJoin('recipe.images', 'image')
        .select('recipe.recipe_post_id', 'recipe_post_id')
        .addSelect('recipe.title', 'title')
        .addSelect('recipe.like_count', 'like_count')
        .addSelect('recipe.comment_count', 'comment_count')
        .addSelect('user.nickname', 'nickname')
        .addSelect('user.location_text', 'location_text')
        .addSelect('MIN(image.image_url)', 'thumbnail')
        .where('recipe.delete_yn = false')
        .andWhere('recipe.is_default = false')
        // 🚧 릴리즈에서 변경: 아래 주석을 해제하여 구 단위 필터링 활성화
        // .andWhere('user.location_text IS NOT NULL')
        // .andWhere('user.location_text LIKE :district', {district: `% ${district} %`})
        .groupBy('recipe.recipe_post_id')
        .addGroupBy('recipe.title')
        .addGroupBy('recipe.like_count')
        .addGroupBy('recipe.comment_count')
        .addGroupBy('user.nickname')
        .addGroupBy('user.location_text')
        .orderBy('recipe.like_count', 'DESC')
        .addOrderBy('recipe.comment_count', 'DESC')
        .addOrderBy('recipe.created_at', 'DESC')
        .limit(limit)
        .getRawMany();

      const formatted = ranking.map((row: any, index: number) => ({
        recipe_post_id: row.recipe_post_id,
        title: row.title,
        like_count: row.like_count ? Number(row.like_count) : 0,
        comment_count: row.comment_count ? Number(row.comment_count) : 0,
        nickname: row.nickname || '이웃',
        thumbnail: normalizeImageUrl(row.thumbnail) || null,
        rank: index + 1,
        location_text: row.location_text || null,
      }));

      console.log(`✅ [RecipeController] 지역 인기 레시피 조회 성공 - ${formatted.length}개`);

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('❌ [RecipeController] 지역 인기 레시피 조회 실패:', error);
      return res.status(500).json({
        success: false,
        message: '지역 인기 레시피를 불러오지 못했습니다.',
      });
    }
  }

  /**
   * 특정 재료를 주재료로 사용한 레시피 중 가장 좋아요가 많은 레시피 조회
   * GET /api/recipes/by-main-ingredient/:ingredient_id/top
   */
  static async getTopRecipeByMainIngredient(req: Request, res: Response) {
    try {
      const ingredientIdParam = req.params.ingredient_id;
      if (!ingredientIdParam) {
        return res.status(400).json({
          success: false,
          message: '재료 ID가 필요합니다.',
        });
      }

      const ingredientId = parseInt(ingredientIdParam);

      if (isNaN(ingredientId)) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 재료 ID입니다.',
        });
      }

      const userId = RecipeController.getUserIdFromRequest(req);

      // 숨겨진 사용자 필터링
      let hiddenUserIds: string[] = [];
      if (userId) {
        const hiddenUsers = await AppDataSource.getRepository(HiddenUser).find({
          where: { user_id: userId },
          select: ['hidden_user_id'],
        });
        hiddenUserIds = hiddenUsers.map(hu => hu.hidden_user_id);
      }

      // ingredient_id로 main_ingredient_id 찾기
      const mainIngredients = await AppDataSource.getRepository(MainIngredient).find({
        where: { ingredient_id: ingredientId },
        select: ['main_ingredient_id'],
      });

      if (!mainIngredients || mainIngredients.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: '해당 재료를 주재료로 사용한 레시피가 없습니다.',
        });
      }

      const mainIngredientIds = mainIngredients.map(mi => mi.main_ingredient_id);

      // 주재료(recipe_relations type=2, child_id=main_ingredient_id)로 사용된 레시피 중 가장 좋아요가 많은 레시피 조회
      const query = AppDataSource.getRepository(RecipePost)
        .createQueryBuilder('recipe')
        .leftJoin('recipe.user', 'user')
        .leftJoin('recipe.images', 'image')
        .select([
          'recipe.recipe_post_id',
          'recipe.title',
          'recipe.description',
          'recipe.like_count',
          'recipe.comment_count',
          'recipe.created_at',
          'user.user_id',
          'user.nickname',
          'user.profile_image_url',
        ])
        .addSelect('MIN(image.image_url)', 'represent_photo_url')
        .where('recipe.delete_yn = false')
        .andWhere('recipe.is_default = false')
        .andWhere(
          `EXISTS (
            SELECT 1 FROM recipe_relations rr 
            WHERE rr.recipe_post_id = recipe.recipe_post_id 
            AND rr.type = 2 
            AND rr.child_id IN (:...mainIngredientIds)
          )`,
          { mainIngredientIds: mainIngredientIds },
        )
        .groupBy('recipe.recipe_post_id')
        .addGroupBy('recipe.title')
        .addGroupBy('recipe.description')
        .addGroupBy('recipe.like_count')
        .addGroupBy('recipe.comment_count')
        .addGroupBy('recipe.created_at')
        .addGroupBy('user.user_id')
        .addGroupBy('user.nickname')
        .addGroupBy('user.profile_image_url')
        .orderBy('recipe.like_count', 'DESC')
        .addOrderBy('recipe.comment_count', 'DESC')
        .addOrderBy('recipe.created_at', 'DESC')
        .limit(1);

      // 숨겨진 사용자의 레시피 제외
      if (hiddenUserIds.length > 0) {
        query.andWhere('recipe.user_id NOT IN (:...hiddenUserIds)', { hiddenUserIds });
      }

      const result = await query.getRawOne();

      if (!result) {
        return res.json({
          success: true,
          data: null,
          message: '해당 재료를 주재료로 사용한 레시피가 없습니다.',
        });
      }

      // 레시피 상세 정보 포맷팅
      const recipe = {
        recipe_post_id: result.recipe_recipe_post_id,
        title: result.recipe_title,
        description: result.recipe_description,
        like_count: Number(result.recipe_like_count || 0),
        comment_count: Number(result.recipe_comment_count || 0),
        represent_photo_url: result.represent_photo_url,
        created_at: result.recipe_created_at,
        user: {
          user_id: result.user_user_id,
          nickname: result.user_nickname,
          profile_image_url: result.user_profile_image_url,
        },
      };

      return res.json({
        success: true,
        data: recipe,
      });
    } catch (error) {
      console.error('주재료별 최고 레시피 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '레시피 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 등록
   * POST /api/recipes
   */
  static async createRecipe(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {
        title,
        description,
        ingredients,
        recipe_steps,
        situation_id,
        cooking_method_id,
        main_ingredient_id, // 단일 ID (하위 호환성)
        main_ingredient_ids, // 배열 ID (새로운 방식)
        location, // {latitude, longitude}
      } = req.body;

      console.log('📥 [RecipeController] 레시피 등록 요청 데이터:', {
        title,
        situation_id,
        cooking_method_id,
        main_ingredient_id,
        main_ingredient_ids,
        location,
        recipe_steps_count: recipe_steps?.length,
      });

      // 필수 정보 검증 (description은 선택사항)
      if (!title || !ingredients || !recipe_steps) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다.',
        });
      }

      // 배열 유효성 검증
      if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({
          success: false,
          message: '재료를 최소 1개 이상 추가해주세요.',
        });
      }

      if (!Array.isArray(recipe_steps) || recipe_steps.length === 0) {
        return res.status(400).json({
          success: false,
          message: '레시피 스텝을 최소 1개 이상 추가해주세요.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipeRelationRepository = AppDataSource.getRepository(RecipeRelation);
      const recipeImageRepository = AppDataSource.getRepository(RecipePostImage);
      const recipeIngredientRepository = AppDataSource.getRepository(RecipeIngredient);
      const recipeStepRepository = AppDataSource.getRepository(RecipeStep);

      // 위치 데이터 처리
      let locationData: { type: 'Point'; coordinates: [number, number] };
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        // 실제 위치 데이터가 있으면 사용
        locationData = {
          type: 'Point',
          coordinates: [location.longitude, location.latitude], // GeoJSON 형식: [longitude, latitude]
        };
        console.log('📍 [RecipeController] 위치 데이터 설정:', locationData);
      } else {
        // 위치 데이터가 없으면 기본 좌표 사용
        locationData = { type: 'Point', coordinates: [0, 0] };
        console.log('📍 [RecipeController] 기본 좌표 사용 (위치 데이터 없음)');
      }

      // 레시피 생성
      const newRecipe = recipeRepository.create({
        user_id: userId,
        title,
        description,
        location: locationData,
        delete_yn: false,
      } as any);

      const savedRecipe = await recipeRepository.save(newRecipe) as any;

      // 관계 설정
      console.log('🔗 [RecipeController] 관계 설정 시작:', {
        recipe_post_id: savedRecipe.recipe_post_id,
        situation_id,
        cooking_method_id,
        main_ingredient_id,
        main_ingredient_ids,
      });

      if (situation_id) {
        console.log('🔗 [RecipeController] Situation 관계 추가:', situation_id);
        const situationRelation = recipeRelationRepository.create({
          recipe_post_id: savedRecipe.recipe_post_id,
          type: 0, // situation
          child_id: situation_id,
        });
        const saved = await recipeRelationRepository.save(situationRelation);
        console.log('✅ [RecipeController] Situation 관계 저장 완료:', saved);
      }

      // cooking_methods 업데이트 쿼리 주석 처리 (디폴트값 0으로 저장은 하지만 검색에는 사용 안 함)
      // if (cooking_method_id) {
      //   console.log('🔗 [RecipeController] Cooking Method 관계 추가:', cooking_method_id);
      //   const methodRelation = recipeRelationRepository.create({
      //     recipe_post_id: savedRecipe.recipe_post_id,
      //     type: 1, // cooking_method
      //     child_id: cooking_method_id,
      //   });
      //   const saved = await recipeRelationRepository.save(methodRelation);
      //   console.log('✅ [RecipeController] Cooking Method 관계 저장 완료:', saved);
      // }

      // 메인 재료 관계 설정 (배열 또는 단일 ID 모두 지원)
      const mainIngredientIdsToSave = main_ingredient_ids || (main_ingredient_id ? [main_ingredient_id] : []);
      console.log('🔗 [RecipeController] Main Ingredient IDs:', mainIngredientIdsToSave);
      for (const mainIngredientId of mainIngredientIdsToSave) {
        if (mainIngredientId) {
          console.log('🔗 [RecipeController] Main Ingredient 관계 추가:', mainIngredientId);
          const ingredientRelation = recipeRelationRepository.create({
            recipe_post_id: savedRecipe.recipe_post_id,
            type: 2, // main_ingredient
            child_id: mainIngredientId,
          });
          const saved = await recipeRelationRepository.save(ingredientRelation);
          console.log('✅ [RecipeController] Main Ingredient 관계 저장 완료:', saved);
        }
      }

      // 재료 저장
      const ingredientRepository = AppDataSource.getRepository(Ingredient);

      for (const ingredient of ingredients) {
        if (!ingredient) {
          console.warn('⚠️ [RecipeController] 빈 재료 항목 건너뛰기');
          continue;
        }

        // ingredient_id 파싱 및 검증
        let ingredientId: number | null = null;

        // 먼저 ingredient_id가 있는지 확인
        if (typeof ingredient.ingredient_id === 'number') {
          ingredientId = ingredient.ingredient_id;
        } else if (ingredient.ingredient_id !== undefined && ingredient.ingredient_id !== null) {
          const parsed = parseInt(String(ingredient.ingredient_id));
          if (!isNaN(parsed) && parsed > 0) {
            ingredientId = parsed;
          }
        } else if (ingredient.id !== undefined && ingredient.id !== null) {
          const parsed = parseInt(String(ingredient.id));
          if (!isNaN(parsed) && parsed > 0) {
            ingredientId = parsed;
          }
        }

        // ingredient_id가 없거나 유효하지 않으면 재료 이름으로 찾기 또는 생성
        if (!ingredientId || ingredientId <= 0) {
          const ingredientName = ingredient.name || ingredient.ingredient_name;
          if (!ingredientName || typeof ingredientName !== 'string' || !ingredientName.trim()) {
            console.error('❌ [RecipeController] 재료 이름이 없습니다:', ingredient);
            continue;
          }

          const trimmedName = ingredientName.trim();
          console.log(`🔍 [RecipeController] 재료 이름으로 찾기/생성: "${trimmedName}"`);

          // 먼저 현재 사용자의 재료 중에서 찾기 (대소문자 무시)
          let foundIngredient = await ingredientRepository.findOne({
            where: {
              name: trimmedName,
              user_id: userId,
            },
          });

          // 사용자 재료에서 못 찾으면 공통 재료(user_id가 NULL)에서 찾기
          if (!foundIngredient) {
            foundIngredient = await ingredientRepository.findOne({
              where: {
                name: trimmedName,
                user_id: IsNull(),
              },
            });
          }

          if (foundIngredient) {
            ingredientId = foundIngredient.ingredient_id;
            console.log(`✅ [RecipeController] 기존 재료 찾음: ${foundIngredient.ingredient_id} - ${foundIngredient.name}`);
          } else {
            // 재료가 없으면 새로 생성
            const defaultUnit = ingredient.unit || '개';
            const newIngredient = ingredientRepository.create({
              name: trimmedName,
              user_id: userId, // 현재 사용자의 재료로 생성
              default_unit: defaultUnit,
            });
            const savedIngredient = await ingredientRepository.save(newIngredient);
            ingredientId = savedIngredient.ingredient_id;
            console.log(`✨ [RecipeController] 새 재료 생성: ${savedIngredient.ingredient_id} - ${savedIngredient.name}`);
          }
        } else {
          // ingredient_id가 있으면 유효성 검증
          const existingIngredient = await ingredientRepository.findOne({
            where: { ingredient_id: ingredientId },
          });
          if (!existingIngredient) {
            console.error(`❌ [RecipeController] 유효하지 않은 재료 ID: ${ingredientId}`);
            continue;
          }
          console.log(`✅ [RecipeController] 기존 재료 ID 사용: ${ingredientId} - ${existingIngredient.name}`);
        }

        const quantity = parseFloat(ingredient.quantity || ingredient.value || '1');
        const unit = ingredient.unit || '개';

        const recipeIngredient = recipeIngredientRepository.create({
          recipe_post_id: savedRecipe.recipe_post_id,
          ingredient_id: ingredientId,
          quantity: quantity,
          unit: unit,
        });
        await recipeIngredientRepository.save(recipeIngredient);
        console.log(`✅ [RecipeController] 레시피 재료 저장 완료: ${ingredientId} - ${quantity}${unit}`);
      }

      // base64 파일을 S3에 저장하는 함수 (이미지/동영상 모두 지원)
      const saveBase64File = async (base64Data: string, originalUri: string, subDir: string, isVideo: boolean = false): Promise<string | null> => {
        try {
          // 파일 확장자 추출
          let fileExt = isVideo ? '.mp4' : '.jpg';
          if (originalUri) {
            const ext = path.extname(originalUri).toLowerCase();
            if (isVideo) {
              // 동영상 확장자
              if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
                fileExt = ext;
              }
            } else {
              // 이미지 확장자
              if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                fileExt = ext;
              }
            }
          }

          // 파일명 생성
          const fileName = `${uuidv4()}${fileExt}`;

          // base64를 버퍼로 변환
          const fileBuffer = Buffer.from(base64Data, 'base64');

          if (isVideo) {
            // 동영상은 그대로 업로드
            const s3Key = `uploads/${subDir}/${fileName}`;
            const contentType = fileExt === '.mp4' ? 'video/mp4' : fileExt === '.mov' ? 'video/quicktime' : 'video/x-msvideo';

            const relativePath = await s3Service.uploadBuffer(fileBuffer, s3Key, contentType);
            console.log(`✅ 동영상 S3 저장 완료: ${relativePath}`);
            return relativePath;
          } else {
            // 이미지는 리사이징 및 썸네일 생성
            try {
              const { resizedBuffer, thumbnailBuffer } = await resizeAndCreateThumbnail(fileBuffer);

              // 리사이징된 원본 이미지 업로드
              const s3Key = `uploads/${subDir}/${fileName}`;
              const contentType = fileExt === '.jpg' || fileExt === '.jpeg' ? 'image/jpeg' : fileExt === '.png' ? 'image/png' : fileExt === '.gif' ? 'image/gif' : 'image/webp';

              const relativePath = await s3Service.uploadBuffer(resizedBuffer, s3Key, contentType);
              console.log(`✅ 이미지 S3 저장 완료: ${relativePath}`);

              // 썸네일 업로드 (실패해도 원본은 저장되도록 별도 처리)
              try {
                console.log(`🔄 [RecipeController] 썸네일 업로드 시작: ${fileName}`);
                console.log(`🔄 [RecipeController] 썸네일 버퍼 크기: ${thumbnailBuffer.length} bytes`);
                const thumbnailFileName = `thumb-${fileName}`;
                const thumbnailS3Key = `uploads/${subDir}/${thumbnailFileName}`;
                console.log(`🔄 [RecipeController] 썸네일 S3 키: ${thumbnailS3Key}`);

                const thumbnailUrl = await s3Service.uploadBuffer(thumbnailBuffer, thumbnailS3Key, contentType);
                console.log(`✅ [RecipeController] 썸네일 S3 저장 완료: ${thumbnailUrl}`);
                console.log(`✅ [RecipeController] 썸네일 저장 경로: uploads/${subDir}/${thumbnailFileName}`);
              } catch (thumbnailError) {
                console.error('❌ [RecipeController] 썸네일 업로드 실패 (원본은 정상 저장됨):', thumbnailError);
                console.error('❌ [RecipeController] 썸네일 에러 상세:', thumbnailError);
                if (thumbnailError instanceof Error) {
                  console.error('❌ [RecipeController] 썸네일 에러 메시지:', thumbnailError.message);
                  console.error('❌ [RecipeController] 썸네일 에러 스택:', thumbnailError.stack);
                }
                // 썸네일 업로드 실패해도 원본은 정상 저장되었으므로 계속 진행
              }

              // DB에 저장할 상대 경로 반환 (예: uploads/recipe/filename.jpg)
              return relativePath;
            } catch (resizeError) {
              console.error('❌ [RecipeController] 이미지 리사이징 실패, 원본 업로드 시도:', resizeError);
              // 리사이징 실패 시 원본 업로드 (하위 호환)
              const s3Key = `uploads/${subDir}/${fileName}`;
              const contentType = fileExt === '.jpg' || fileExt === '.jpeg' ? 'image/jpeg' : fileExt === '.png' ? 'image/png' : fileExt === '.gif' ? 'image/gif' : 'image/webp';

              const relativePath = await s3Service.uploadBuffer(fileBuffer, s3Key, contentType);
              console.log(`✅ 이미지 S3 저장 완료 (원본): ${relativePath}`);
              return relativePath;
            }
          }
        } catch (error) {
          console.error(`${isVideo ? '동영상' : '이미지'} S3 저장 오류:`, error);
          return null;
        }
      };

      // 단계 저장 및 이미지/동영상 처리
      for (let i = 0; i < recipe_steps.length; i++) {
        const step = recipe_steps[i];
        let stepImageUrl = null;
        let stepVideoUrl = null;

        // base64 이미지가 있으면 파일로 저장
        if (step.image_base64) {
          stepImageUrl = await saveBase64File(step.image_base64, step.image_uri || '', 'recipe', false);
        }

        // base64 동영상이 있으면 파일로 저장
        if (step.video_base64) {
          stepVideoUrl = await saveBase64File(step.video_base64, step.video_uri || '', 'recipe', true);
        }

        const recipeStep = recipeStepRepository.create({
          recipe_post_id: savedRecipe.recipe_post_id,
          step_number: step.step_number,
          instruction: step.instruction || '',
          image_url: stepImageUrl || undefined,
          video_url: stepVideoUrl || undefined,
        } as any);
        await recipeStepRepository.save(recipeStep);
        console.log(`✅ [RecipeController] 레시피 스텝 ${i + 1} 저장 완료`);
      }

      // 완성 사진 저장 (recipe_post_images)
      const completed_images = req.body.completed_images || [];
      for (let i = 0; i < completed_images.length; i++) {
        const imageData = completed_images[i];
        if (imageData && imageData.base64) {
          const savedPath = await saveBase64File(imageData.base64, imageData.uri || '', 'recipe', false);
          if (!savedPath) {
            console.error(`완성 사진 저장 실패: ${imageData.uri}`);
            continue;
          }

          const recipeImage = recipeImageRepository.create({
            recipe_post_id: savedRecipe.recipe_post_id,
            image_url: savedPath,
            sequence: i, // 순서대로 저장
          });
          await recipeImageRepository.save(recipeImage);
          console.log(`✅ [RecipeController] 완성 사진 ${i + 1} 저장 완료: ${savedPath}`);
        }
      }

      // 타이틀 체크 (비동기 처리 - 레시피 생성 성공 후)
      TitleService.checkTitleOnRecipeCreate(userId, savedRecipe.recipe_post_id).catch((error: any) => {
        console.error('❌ [타이틀 체크] 레시피 작성 후 타이틀 체크 오류:', error);
      });

      return res.status(201).json({
        success: true,
        message: '레시피가 성공적으로 등록되었습니다.',
        data: {
          recipe_post_id: savedRecipe.recipe_post_id,
        },
      });
    } catch (error) {
      console.error('레시피 등록 오류:', error);
      console.error('오류 상세:', (error as Error).message);
      console.error('오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: (error as Error).message, // 개발 중에만 오류 메시지 포함
      });
    }
  }

  /**
   * 메인 피드 레시피 목록 조회
   * GET /api/recipes/feed
   */
  static async getFeed(req: Request, res: Response) {
    try {
      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const currentUserId = RecipeController.getUserIdFromRequest(req);

      // 숨김 처리된 사용자 목록 조회 (인증된 사용자인 경우만)
      let hiddenUserIds: string[] = [];
      if (currentUserId) {
        const hiddenUsers = await AppDataSource.getRepository(HiddenUser).find({
          where: { user_id: currentUserId },
          select: ['hidden_user_id'],
        });
        hiddenUserIds = hiddenUsers.map(h => h.hidden_user_id);
      }

      // 쿼리 빌더로 숨김 처리된 사용자의 게시글 제외
      const queryBuilder = recipeRepository
        .createQueryBuilder('recipe')
        .leftJoinAndSelect('recipe.user', 'user')
        .leftJoinAndSelect('recipe.images', 'images')
        .where('recipe.delete_yn = :deleteYn', { deleteYn: false })
        .andWhere('recipe.is_default = :isDefault', { isDefault: false })
        .andWhere('user.delete_yn = :userDeleteYn', { userDeleteYn: false });

      // 숨김 처리된 사용자의 게시글 제외
      if (hiddenUserIds.length > 0) {
        queryBuilder.andWhere('user.user_id NOT IN (:...hiddenUserIds)', { hiddenUserIds });
      }

      const recipes = await queryBuilder
        .orderBy('recipe.created_at', 'DESC')
        .take(50)
        .getMany();

      const feed = recipes.map(recipe => ({
        recipe_post_id: recipe.recipe_post_id,
        title: recipe.title,
        description: recipe.description,
        like_count: recipe.like_count ?? 0,
        comment_count: recipe.comment_count ?? 0,
        created_at: recipe.created_at,
        user: recipe.user
          ? {
            user_id: recipe.user.user_id,
            nickname: recipe.user.nickname,
            profile_image_url: normalizeImageUrl(recipe.user.profile_image_url) || null,
          }
          : null,
        images: (recipe.images || [])
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
          .map(image => {
            // 첫 번째 이미지는 썸네일, 나머지는 원본 URL 반환
            const imageUrl = normalizeImageUrl(image.image_url);
            const index = recipe.images?.indexOf(image) ?? 0;
            // 첫 번째 이미지만 썸네일 사용 (피드에서 표시용)
            return index === 0 && imageUrl ? getThumbnailUrl(imageUrl) : imageUrl;
          }),
      }));

      return res.json({
        success: true,
        data: feed,
      });
    } catch (error) {
      console.error('피드 레시피 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '피드 데이터를 불러오지 못했습니다.',
      });
    }
  }

  /**
   * 공개 공유용 레시피 상세 조회 (인증 불필요)
   * GET /api/recipes/{recipe_post_id}/share
   */
  static async getRecipeForShare(req: Request, res: Response) {
    try {
      const { recipe_post_id } = req.params;

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, delete_yn: false },
        relations: [
          'user',
          'images',
          'ingredients',
          'ingredients.ingredient',
          'steps',
        ],
      });

      const relationRepository = AppDataSource.getRepository(RecipeRelation);
      const relations = await relationRepository.find({ where: { recipe_post_id } });

      const situationRelation = relations.find(rel => rel.type === 0);
      const cookingMethodRelation = relations.find(rel => rel.type === 1);
      const mainIngredientRelations = relations.filter(rel => rel.type === 2);

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      // 공개 공유용 레시피 정보 (댓글 제외, is_liked 제외)
      const formattedRecipe = {
        recipe_post_id: recipe.recipe_post_id,
        recipe_images: recipe.images?.map(img => ({
          image_url: normalizeImageUrl(img.image_url),
          image_id: img.image_id,
        })) || [],
        images: recipe.images?.map(img => normalizeImageUrl(img.image_url)) || [],
        title: recipe.title,
        description: recipe.description,
        user: {
          user_id: recipe.user?.user_id,
          nickname: recipe.user?.nickname,
          profile_image_url: normalizeImageUrl(recipe.user?.profile_image_url),
        },
        like_count: recipe.like_count ?? 0,
        comment_count: recipe.comment_count ?? 0,
        ingredients: recipe.ingredients?.map(ing => ({
          ingredient_id: ing.ingredient_id,
          name: ing.ingredient?.name || '',
          quantity:
            typeof ing.quantity === 'number'
              ? ing.quantity.toString()
              : (ing.quantity as unknown as string) || '0',
          unit: ing.unit || ing.ingredient?.default_unit || '',
        })) || [],
        recipe_steps: recipe.steps?.map(step => ({
          step_number: step.step_number,
          instruction: step.instruction,
          image_url: step.image_url || null,
          video_url: step.video_url || null,
        })) || [],
        steps: recipe.steps?.map(step => ({
          description: step.instruction,
          imageUrl: step.image_url || null,
          videoUrl: step.video_url || null,
        })) || [],
        relations: {
          situation_id: situationRelation?.child_id ?? null,
          cooking_method_id: cookingMethodRelation?.child_id ?? null,
          main_ingredient_ids: mainIngredientRelations.map(rel => rel.child_id),
        },
        created_at: recipe.created_at,
      };

      return res.json({
        success: true,
        data: formattedRecipe,
      });
    } catch (error) {
      console.error('공개 공유용 레시피 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 상세 조회
   * GET /api/recipes/{recipe_post_id}
   */
  static async getRecipeDetail(req: Request, res: Response) {
    try {
      const { recipe_post_id } = req.params;

      const recipeRepository = AppDataSource.getRepository(RecipePost);

      // 디버깅: 레시피 조회 전 로그
      console.log(`[getRecipeDetail] 레시피 조회 시도: ${recipe_post_id}`);

      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, delete_yn: false },
        relations: [
          'user',
          'images',
          'ingredients',
          'ingredients.ingredient',
          'steps',
        ],
      });

      // 디버깅: 레시피 조회 결과 로그
      if (!recipe) {
        console.log(`[getRecipeDetail] 레시피를 찾을 수 없음: ${recipe_post_id}`);
        // 레시피가 없는 경우, delete_yn이나 다른 이유로 조회되지 않는지 확인
        const recipeWithoutDeleteCheck = await recipeRepository.findOne({
          where: { recipe_post_id },
        });
        if (recipeWithoutDeleteCheck) {
          console.log(`[getRecipeDetail] 레시피 존재하지만 delete_yn=${recipeWithoutDeleteCheck.delete_yn}, is_default=${recipeWithoutDeleteCheck.is_default}`);
        } else {
          console.log(`[getRecipeDetail] 레시피가 DB에 존재하지 않음: ${recipe_post_id}`);
        }
      } else {
        console.log(`[getRecipeDetail] 레시피 조회 성공: ${recipe_post_id}, is_default=${recipe.is_default}`);
      }

      const relationRepository = AppDataSource.getRepository(RecipeRelation);
      const relations = await relationRepository.find({ where: { recipe_post_id } });
      const likeRepository = AppDataSource.getRepository(Like);
      const commentRepository = AppDataSource.getRepository(Comment);

      const situationRelation = relations.find(rel => rel.type === 0);
      const cookingMethodRelation = relations.find(rel => rel.type === 1);
      const mainIngredientRelations = relations.filter(rel => rel.type === 2);

      const currentUserId = RecipeController.getUserIdFromRequest(req);
      let isLiked = false;
      if (currentUserId) {
        const existingLike = await likeRepository.findOne({
          where: { recipe_post_id, user_id: currentUserId },
        });
        isLiked = !!existingLike;
      }

      const commentEntities = await commentRepository.find({
        where: { recipe_post_id, delete_yn: false },
        relations: ['user'],
        order: { created_at: 'ASC' },
        take: 30, // 성능 최적화: 댓글이 많을 경우 상위 30개만 우선 로드 (추후 페이지네이션 필요)
      });
      const comments = RecipeController.buildCommentTree(commentEntities);

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      const formattedRecipe = {
        recipe_images: recipe.images?.map(img => ({
          image_url: img.image_url,
          image_id: img.image_id,
        })) || [],
        title: recipe.title,
        description: recipe.description,
        user: {
          user_id: recipe.user?.user_id,
          nickname: recipe.user?.nickname,
          profile_image_url: normalizeImageUrl(recipe.user?.profile_image_url),
        },
        like_count: recipe.like_count ?? 0,
        is_liked: isLiked,
        comment_count: recipe.comment_count ?? 0,
        recipe_post_id: recipe.recipe_post_id,
        ingredients: recipe.ingredients?.map(ing => ({
          ingredient_id: ing.ingredient_id,
          name: ing.ingredient?.name || '',
          quantity:
            typeof ing.quantity === 'number'
              ? ing.quantity
              : parseFloat((ing.quantity as unknown as string) || '0') || 0,
          unit: ing.unit || ing.ingredient?.default_unit || '',
        })) || [],
        recipe_steps: recipe.steps?.map(step => ({
          step_number: step.step_number,
          instruction: step.instruction,
          image_url: step.image_url || null,
          video_url: step.video_url || null,
        })) || [],
        relations: {
          situation_id: situationRelation?.child_id ?? null,
          cooking_method_id: cookingMethodRelation?.child_id ?? null,
          main_ingredient_ids: mainIngredientRelations.map(rel => rel.child_id),
        },
        comments,
      };

      return res.json({
        success: true,
        data: formattedRecipe,
      });
    } catch (error) {
      console.error('레시피 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 기본 재료 조회
   * GET /api/recipes/{recipe_post_id}/default-ingredients
   */
  static async getDefaultIngredients(req: Request, res: Response) {
    try {
      const { recipe_post_id } = req.params;

      const recipeIngredientRepository = AppDataSource.getRepository(RecipeIngredient);
      const ingredients = await recipeIngredientRepository.find({
        where: { recipe_post_id },
        relations: ['ingredient'],
        order: { ingredient_id: 'ASC' },
      });

      const formattedIngredients = ingredients.map(ing => ({
        id: ing.ingredient_id.toString(),
        name: ing.ingredient?.name || '',
        value: ing.quantity.toString(),
        unit: ing.unit,
      }));

      return res.json({
        success: true,
        data: formattedIngredients,
      });
    } catch (error) {
      console.error('기본 재료 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 기본 스텝 조회
   * GET /api/recipes/{recipe_post_id}/default-steps
   */
  static async getDefaultSteps(req: Request, res: Response) {
    try {
      const { recipe_post_id } = req.params;

      const recipeStepRepository = AppDataSource.getRepository(RecipeStep);
      const steps = await recipeStepRepository.find({
        where: { recipe_post_id },
        order: { step_number: 'ASC' },
      });

      const formattedSteps = steps.map((step, index) => ({
        id: (index + 1).toString(),
        description: step.instruction,
        imageUrl: step.image_url || null,
      }));

      return res.json({
        success: true,
        data: formattedSteps,
      });
    } catch (error) {
      console.error('기본 스텝 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 수정
   * PUT /api/recipes/{recipe_post_id}
   */
  static async updateRecipe(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const { recipe_post_id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, user_id: userId, delete_yn: false },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      // 기본 레시피(is_default = true)는 수정할 수 없음
      if (recipe.is_default) {
        return res.status(403).json({
          success: false,
          message: '기본 레시피는 수정할 수 없습니다.',
        });
      }

      const {
        title,
        description,
        ingredients = [],
        recipe_steps = [],
        situation_id,
        cooking_method_id,
        main_ingredient_id,
        main_ingredient_ids,
        location,
        completed_images = [],
      } = req.body;

      const normalizeUploadPath = (uri?: string | null): string | null => {
        if (!uri) {
          return null;
        }
        // 이미 S3 URL이면 그대로 반환
        if (uri.startsWith('https://') || uri.startsWith('http://')) {
          return uri;
        }
        // 로컬 경로 형식(/uploads/...)을 S3 URL로 변환
        if (uri.startsWith('/uploads/')) {
          const relativePath = uri.substring('/uploads/'.length);
          const s3BaseUrl = process.env.AWS_S3_BASE_URL || `https://${process.env.AWS_S3_BUCKET_NAME || 'slowflowsoft-storage-bucket'}.s3.ap-northeast-2.amazonaws.com/${process.env.AWS_S3_PROJECT_PREFIX || 'babple'}`;
          return `${s3BaseUrl}/uploads/${relativePath}`;
        }
        const uploadsIndex = uri.indexOf('/uploads/');
        if (uploadsIndex >= 0) {
          const relativePath = uri.substring(uploadsIndex + '/uploads/'.length);
          const s3BaseUrl = process.env.AWS_S3_BASE_URL || `https://${process.env.AWS_S3_BUCKET_NAME || 'slowflowsoft-storage-bucket'}.s3.ap-northeast-2.amazonaws.com/${process.env.AWS_S3_PROJECT_PREFIX || 'babple'}`;
          return `${s3BaseUrl}/uploads/${relativePath}`;
        }
        // 상대 경로 형식(recipe/filename.jpg)을 S3 URL로 변환
        if (!uri.startsWith('http')) {
          const s3BaseUrl = process.env.AWS_S3_BASE_URL || `https://${process.env.AWS_S3_BUCKET_NAME || 'slowflowsoft-storage-bucket'}.s3.ap-northeast-2.amazonaws.com/${process.env.AWS_S3_PROJECT_PREFIX || 'babple'}`;
          return `${s3BaseUrl}/uploads/${uri}`;
        }
        return uri;
      };

      const saveBase64File = async (
        base64Data: string,
        originalUri: string,
        subDir: string,
        isVideo: boolean = false,
      ): Promise<string | null> => {
        try {
          let fileExt = isVideo ? '.mp4' : '.jpg';
          if (originalUri) {
            const ext = path.extname(originalUri).toLowerCase();
            if (isVideo) {
              if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
                fileExt = ext;
              }
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
              fileExt = ext;
            }
          }

          const fileName = `${uuidv4()}${fileExt}`;

          // base64를 버퍼로 변환
          const fileBuffer = Buffer.from(base64Data, 'base64');

          if (isVideo) {
            // 동영상은 그대로 업로드
            const s3Key = `uploads/${subDir}/${fileName}`;
            const contentType = fileExt === '.mp4' ? 'video/mp4' : fileExt === '.mov' ? 'video/quicktime' : 'video/x-msvideo';

            const s3Url = await s3Service.uploadBuffer(fileBuffer, s3Key, contentType);
            console.log(`✅ 동영상 S3 저장 완료 (업데이트): ${s3Url}`);
            return s3Url;
          } else {
            // 이미지는 리사이징 및 썸네일 생성
            try {
              console.log(`🔄 [RecipeController] 이미지 리사이징 및 썸네일 생성 시작 (업데이트): ${fileName}`);
              const { resizedBuffer, thumbnailBuffer } = await resizeAndCreateThumbnail(fileBuffer);
              console.log(`✅ [RecipeController] 이미지 리사이징 및 썸네일 생성 완료 (업데이트)`);
              console.log(`📊 [RecipeController] 리사이즈 버퍼 크기 (업데이트): ${resizedBuffer.length} bytes`);
              console.log(`📊 [RecipeController] 썸네일 버퍼 크기 (업데이트): ${thumbnailBuffer.length} bytes`);

              // 리사이징된 원본 이미지 업로드
              const s3Key = `uploads/${subDir}/${fileName}`;
              const contentType = fileExt === '.jpg' || fileExt === '.jpeg' ? 'image/jpeg' : fileExt === '.png' ? 'image/png' : fileExt === '.gif' ? 'image/gif' : 'image/webp';

              const s3Url = await s3Service.uploadBuffer(resizedBuffer, s3Key, contentType);
              console.log(`✅ 이미지 S3 저장 완료 (업데이트): ${s3Url}`);

              // 썸네일 업로드 (실패해도 원본은 저장되도록 별도 처리)
              try {
                console.log(`🔄 [RecipeController] 썸네일 업로드 시작 (업데이트): ${fileName}`);
                console.log(`🔄 [RecipeController] 썸네일 버퍼 크기 (업데이트): ${thumbnailBuffer.length} bytes`);
                const thumbnailFileName = `thumb-${fileName}`;
                const thumbnailS3Key = `uploads/${subDir}/${thumbnailFileName}`;
                console.log(`🔄 [RecipeController] 썸네일 S3 키 (업데이트): ${thumbnailS3Key}`);

                const thumbnailUrl = await s3Service.uploadBuffer(thumbnailBuffer, thumbnailS3Key, contentType);
                console.log(`✅ [RecipeController] 썸네일 S3 저장 완료 (업데이트): ${thumbnailUrl}`);
                console.log(`✅ [RecipeController] 썸네일 저장 경로 (업데이트): uploads/${subDir}/${thumbnailFileName}`);
              } catch (thumbnailError) {
                console.error('❌ [RecipeController] 썸네일 업로드 실패 (업데이트, 원본은 정상 저장됨):', thumbnailError);
                console.error('❌ [RecipeController] 썸네일 에러 상세 (업데이트):', thumbnailError);
                if (thumbnailError instanceof Error) {
                  console.error('❌ [RecipeController] 썸네일 에러 메시지 (업데이트):', thumbnailError.message);
                  console.error('❌ [RecipeController] 썸네일 에러 스택 (업데이트):', thumbnailError.stack);
                }
                // 썸네일 업로드 실패해도 원본은 정상 저장되었으므로 계속 진행
              }

              return s3Url;
            } catch (resizeError) {
              console.error('❌ [RecipeController] 이미지 리사이징 실패 (업데이트), 원본 업로드 시도:', resizeError);
              // 리사이징 실패 시 원본 업로드 (하위 호환)
              const s3Key = `uploads/${subDir}/${fileName}`;
              const contentType = fileExt === '.jpg' || fileExt === '.jpeg' ? 'image/jpeg' : fileExt === '.png' ? 'image/png' : fileExt === '.gif' ? 'image/gif' : 'image/webp';

              const s3Url = await s3Service.uploadBuffer(fileBuffer, s3Key, contentType);
              console.log(`✅ 이미지 S3 저장 완료 (업데이트, 원본): ${s3Url}`);
              return s3Url;
            }
          }
        } catch (error) {
          console.error(`${isVideo ? '동영상' : '이미지'} S3 저장 오류(업데이트):`, error);
          return null;
        }
      };

      await AppDataSource.transaction(async transactionalEntityManager => {
        const recipeRepoTx = transactionalEntityManager.getRepository(RecipePost);
        const relationRepo = transactionalEntityManager.getRepository(RecipeRelation);
        const ingredientRepo = transactionalEntityManager.getRepository(RecipeIngredient);
        const stepRepo = transactionalEntityManager.getRepository(RecipeStep);
        const imageRepo = transactionalEntityManager.getRepository(RecipePostImage);

        if (title !== undefined) {
          recipe.title = title;
        }
        if (description !== undefined) {
          recipe.description = description;
        }
        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
          recipe.location = {
            type: 'Point',
            coordinates: [location.longitude, location.latitude],
          } as any;
        }

        await recipeRepoTx.save(recipe);

        // 관계 재설정
        await relationRepo.delete({ recipe_post_id });

        if (situation_id) {
          const situationRelation = relationRepo.create({
            recipe_post_id,
            type: 0,
            child_id: situation_id,
          });
          await relationRepo.save(situationRelation);
        }

        // cooking_methods 업데이트 쿼리 주석 처리 (디폴트값 0으로 저장은 하지만 검색에는 사용 안 함)
        // if (cooking_method_id) {
        //   const methodRelation = relationRepo.create({
        //     recipe_post_id,
        //     type: 1,
        //     child_id: cooking_method_id,
        //   });
        //   await relationRepo.save(methodRelation);
        // }

        const mainIngredientIdsToSave = Array.isArray(main_ingredient_ids) && main_ingredient_ids.length > 0
          ? main_ingredient_ids
          : main_ingredient_id
            ? [main_ingredient_id]
            : [];

        for (const mainIngredientId of mainIngredientIdsToSave) {
          if (!mainIngredientId) continue;
          const ingredientRelation = relationRepo.create({
            recipe_post_id,
            type: 2,
            child_id: mainIngredientId,
          });
          await relationRepo.save(ingredientRelation);
        }

        // 재료 재설정
        await ingredientRepo.delete({ recipe_post_id });
        if (Array.isArray(ingredients)) {
          const ingredientRepository = transactionalEntityManager.getRepository(Ingredient);

          for (const ingredient of ingredients) {
            if (!ingredient) continue;

            // ingredient_id 파싱 및 검증
            let ingredientId: number | null = null;

            // 먼저 ingredient_id가 있는지 확인
            if (typeof ingredient.ingredient_id === 'number') {
              ingredientId = ingredient.ingredient_id;
            } else if (ingredient.ingredient_id !== undefined && ingredient.ingredient_id !== null) {
              const parsed = parseInt(String(ingredient.ingredient_id));
              if (!isNaN(parsed) && parsed > 0) {
                ingredientId = parsed;
              }
            } else if (ingredient.id !== undefined && ingredient.id !== null) {
              const parsed = parseInt(String(ingredient.id));
              if (!isNaN(parsed) && parsed > 0) {
                ingredientId = parsed;
              }
            }

            // ingredient_id가 없거나 유효하지 않으면 재료 이름으로 찾기 또는 생성
            if (!ingredientId || ingredientId <= 0) {
              const ingredientName = ingredient.name || ingredient.ingredient_name;
              if (!ingredientName || typeof ingredientName !== 'string' || !ingredientName.trim()) {
                console.error('❌ [RecipeController] 재료 이름이 없습니다:', ingredient);
                continue;
              }

              const trimmedName = ingredientName.trim();
              console.log(`🔍 [RecipeController] 재료 이름으로 찾기/생성: "${trimmedName}"`);

              // 먼저 현재 사용자의 재료 중에서 찾기
              let foundIngredient = await ingredientRepository.findOne({
                where: {
                  name: trimmedName,
                  user_id: userId,
                },
              });

              // 사용자 재료에서 못 찾으면 공통 재료(user_id가 NULL)에서 찾기
              if (!foundIngredient) {
                foundIngredient = await ingredientRepository.findOne({
                  where: {
                    name: trimmedName,
                    user_id: IsNull(),
                  },
                });
              }

              if (foundIngredient) {
                ingredientId = foundIngredient.ingredient_id;
                console.log(`✅ [RecipeController] 기존 재료 찾음: ${foundIngredient.ingredient_id} - ${foundIngredient.name}`);
              } else {
                // 재료가 없으면 새로 생성
                const defaultUnit = ingredient.unit || '개';
                const newIngredient = ingredientRepository.create({
                  name: trimmedName,
                  user_id: userId, // 현재 사용자의 재료로 생성
                  default_unit: defaultUnit,
                });
                const savedIngredient = await ingredientRepository.save(newIngredient);
                ingredientId = savedIngredient.ingredient_id;
                console.log(`✨ [RecipeController] 새 재료 생성: ${savedIngredient.ingredient_id} - ${savedIngredient.name}`);
              }
            } else {
              // ingredient_id가 있으면 유효성 검증
              const existingIngredient = await ingredientRepository.findOne({
                where: { ingredient_id: ingredientId },
              });
              if (!existingIngredient) {
                console.error(`❌ [RecipeController] 유효하지 않은 재료 ID: ${ingredientId}`);
                continue;
              }
              console.log(`✅ [RecipeController] 기존 재료 ID 사용: ${ingredientId} - ${existingIngredient.name}`);
            }

            const quantityRaw = ingredient.quantity;
            const quantityValue =
              typeof quantityRaw === 'number'
                ? quantityRaw
                : parseFloat((quantityRaw as unknown as string) || '0') || 0;
            const ingredientEntity = ingredientRepo.create({
              recipe_post_id,
              ingredient_id: ingredientId,
              quantity: quantityValue,
              unit: ingredient.unit || '개',
            });
            await ingredientRepo.save(ingredientEntity);
            console.log(`✅ [RecipeController] 레시피 재료 저장 완료: ${ingredientId} - ${quantityValue}${ingredient.unit || '개'}`);
          }
        }

        // 스텝 재설정
        await stepRepo.delete({ recipe_post_id });
        if (Array.isArray(recipe_steps)) {
          for (let index = 0; index < recipe_steps.length; index++) {
            const step = recipe_steps[index];
            if (!step) continue;

            let stepImageUrl: string | null = null;
            let stepVideoUrl: string | null = null;

            const normalizedImageUri = normalizeUploadPath(step.image_uri || step.imageUrl || '');
            const normalizedVideoUri = normalizeUploadPath(step.video_uri || step.videoUrl || '');

            if (step.image_base64) {
              stepImageUrl = await saveBase64File(step.image_base64, step.image_uri || '', 'recipe', false);
            } else if (normalizedImageUri) {
              stepImageUrl = normalizedImageUri;
            }

            if (step.video_base64) {
              stepVideoUrl = await saveBase64File(step.video_base64, step.video_uri || '', 'recipe', true);
            } else if (normalizedVideoUri) {
              stepVideoUrl = normalizedVideoUri;
            }

            const stepEntity = stepRepo.create({
              recipe_post_id,
              step_number: step.step_number || index + 1,
              instruction: step.instruction || '',
              image_url: stepImageUrl || undefined,
              video_url: stepVideoUrl || undefined,
            } as any);
            await stepRepo.save(stepEntity);
          }
        }

        // 완성 이미지 재설정
        await imageRepo.delete({ recipe_post_id });
        if (Array.isArray(completed_images)) {
          for (let index = 0; index < completed_images.length; index++) {
            const imageData = completed_images[index];
            if (!imageData) continue;

            let imagePath: string | null = null;
            const normalizedUri = normalizeUploadPath(imageData.uri);

            if (imageData.base64) {
              imagePath = await saveBase64File(imageData.base64, imageData.uri || '', 'recipe', false);
            } else if (normalizedUri) {
              imagePath = normalizedUri;
            }

            if (!imagePath) {
              continue;
            }

            const imageEntity = imageRepo.create({
              recipe_post_id,
              image_url: imagePath,
              sequence: index,
            });
            await imageRepo.save(imageEntity);
          }
        }
      });

      return res.json({
        success: true,
        message: '레시피가 성공적으로 수정되었습니다.',
      });
    } catch (error) {
      console.error('레시피 수정 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 삭제
   * DELETE /api/recipes/{recipe_post_id}
   */
  static async deleteRecipe(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const { recipe_post_id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, user_id: userId, delete_yn: false },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      // 소프트 삭제
      recipe.delete_yn = true;
      recipe.deleted_at = new Date();
      await recipeRepository.save(recipe);

      return res.json({
        success: true,
        message: '레시피가 성공적으로 삭제되었습니다.',
      });
    } catch (error) {
      console.error('레시피 삭제 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 실시간 검색
   * GET /api/recipes/search?keyword=...
   */
  static async searchRecipes(req: Request, res: Response) {
    try {
      const rawKeyword = (req.query.keyword as string | undefined) ?? '';
      const keyword = rawKeyword.trim();

      if (!keyword) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);

      // Full Text Search 적용 (GIN 인덱스 활용)
      const baseQuery = recipeRepository
        .createQueryBuilder('recipe')
        .select('recipe.recipe_post_id', 'recipe_post_id')
        .addSelect('recipe.title', 'title')
        .addSelect('recipe.like_count', 'like_count')
        .addSelect('recipe.comment_count', 'comment_count')
        .addSelect('recipe.created_at', 'created_at')
        .addSelect(subQuery => {
          return subQuery
            .select('image.image_url')
            .from(RecipePostImage, 'image')
            .where('image.recipe_post_id = recipe.recipe_post_id')
            .orderBy('image.sequence', 'ASC')
            .limit(1);
        }, 'thumbnail')
        .leftJoin('recipe.ingredients', 'recipeIngredient')
        .leftJoin('recipeIngredient.ingredient', 'ingredient')
        .where('recipe.delete_yn = false')
        .andWhere('recipe.is_default = false')
        .andWhere(
          new Brackets(qb => {
            // pg_trgm 인덱스를 활용한 LIKE 검색 (한국어 'korean' 설정 부재 대응)
            // idx_recipe_post_title_trgm 인덱스가 있으면 ILIKE '%...%' 검색도 매우 빠름
            qb.where('recipe.title ILIKE :keyword')
              .orWhere('LOWER(ingredient.name) LIKE :keywordRaw');
          }),
        )
        // .setParameter('keyword', keyword) -> ILIKE를 위해 앞뒤에 % 추가
        .setParameter('keyword', `%${keyword}%`)
        .setParameter('keywordRaw', `%${keyword.toLowerCase()}%`)
        // 정렬은 최신순 (관련도 정렬은 Trigram에서 복잡하므로 최신순 우선)
        .orderBy('recipe.created_at', 'DESC')
        .limit(60);

      const rawRecipes = await baseQuery.getRawMany();

      const seen = new Set<string>();
      const orderedRows = rawRecipes.filter(row => {
        const id = row.recipe_post_id;
        if (!id || seen.has(id)) {
          return false;
        }
        seen.add(id);
        return true;
      });

      if (orderedRows.length === 0) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const data = orderedRows.map(row => ({
        recipe_post_id: row.recipe_post_id,
        title: row.title,
        like_count: Number(row.like_count ?? 0),
        comment_count: Number(row.comment_count ?? 0),
        thumbnail: row.thumbnail ?? null,
      }));

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('레시피 검색 오류:', error);
      return res.status(500).json({
        success: false,
        message: '레시피 검색 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 좋아요
   * POST /api/recipes/{recipe_post_id}/like
   */
  static async likeRecipe(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const { recipe_post_id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const likeRepository = AppDataSource.getRepository(Like);

      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, delete_yn: false },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      const existingLike = await likeRepository.findOne({
        where: { recipe_post_id, user_id: userId },
      });

      await AppDataSource.transaction(async transactionalEntityManager => {
        if (!existingLike) {
          const likeEntity = likeRepository.create({
            recipe_post_id,
            user_id: userId,
          });
          await transactionalEntityManager.getRepository(Like).save(likeEntity);

          await transactionalEntityManager
            .createQueryBuilder()
            .update(RecipePost)
            .set({ like_count: () => 'COALESCE(like_count, 0) + 1' })
            .where('recipe_post_id = :recipe_post_id', { recipe_post_id })
            .execute();
        }
      });

      const updatedRecipe = await recipeRepository.findOne({
        where: { recipe_post_id },
        select: ['recipe_post_id', 'user_id', 'like_count'],
      });
      const updatedLikeCount = updatedRecipe?.like_count ?? (recipe.like_count ?? 0);

      // 타이틀 체크 및 알림 생성 (비동기 처리)
      if (!existingLike && updatedRecipe?.user_id && userId && recipe_post_id) {
        // 알림 및 타이틀 체크 (Promise.all로 병렬 처리하고 에러가 메인 흐름을 방해하지 않도록 함)
        Promise.all([
          // 레시피 작성자에게 좋아요 받음 타이틀 체크
          TitleService.checkTitleOnLikeReceived(updatedRecipe.user_id, recipe_post_id).catch(e => console.error('Title Error:', e)),
          // 좋아요를 누른 사용자에게 활발한 사용자 타이틀 체크
          TitleService.checkTitleOnLikeGiven(userId).catch(e => console.error('Title Error:', e)),
          // 알림 생성
          NotificationController.createNotification(updatedRecipe.user_id, userId, 'NEW_LIKE', recipe_post_id).catch(e => console.error('Noti Error:', e))
        ]).catch(err => console.error('Async task error:', err));
      }

      return res.json({
        success: true,
        message: existingLike ? '이미 좋아요를 누른 레시피입니다.' : '좋아요가 반영되었습니다.',
        data: {
          like_count: updatedLikeCount,
          liked: true,
        },
      });
    } catch (error) {
      console.error('레시피 좋아요 오류:', error);
      return res.status(500).json({
        success: false,
        message: '좋아요 처리 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 좋아요 취소
   * DELETE /api/recipes/{recipe_post_id}/like
   */
  static async unlikeRecipe(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const { recipe_post_id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const likeRepository = AppDataSource.getRepository(Like);

      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, delete_yn: false },
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      await AppDataSource.transaction(async transactionalEntityManager => {
        const existingLike = await transactionalEntityManager.getRepository(Like).findOne({
          where: { recipe_post_id, user_id: userId },
        });

        if (existingLike) {
          await transactionalEntityManager
            .getRepository(Like)
            .delete({ recipe_post_id, user_id: userId });

          await transactionalEntityManager
            .createQueryBuilder()
            .update(RecipePost)
            .set({ like_count: () => 'GREATEST(COALESCE(like_count, 0) - 1, 0)' })
            .where('recipe_post_id = :recipe_post_id', { recipe_post_id })
            .execute();
        }
      });

      const updatedRecipe = await recipeRepository.findOne({ where: { recipe_post_id } });
      const updatedLikeCount = updatedRecipe?.like_count ?? (recipe.like_count ?? 0);

      return res.json({
        success: true,
        message: '좋아요가 해제되었습니다.',
        data: {
          like_count: updatedLikeCount,
          liked: false,
        },
      });
    } catch (error) {
      console.error('레시피 좋아요 해제 오류:', error);
      return res.status(500).json({
        success: false,
        message: '좋아요 해제 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 레시피 댓글 작성
   * POST /api/recipes/{recipe_post_id}/comments
   */
  static async createComment(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const { recipe_post_id } = req.params;
      const { content, parent_comment_id } = req.body || {};

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const trimmedContent = (content || '').toString().trim();
      if (!trimmedContent) {
        return res.status(400).json({
          success: false,
          message: '댓글 내용을 입력해주세요.',
        });
      }

      const recipeRepository = AppDataSource.getRepository(RecipePost);
      const commentRepository = AppDataSource.getRepository(Comment);

      const recipe = await recipeRepository.findOne({
        where: { recipe_post_id, delete_yn: false },
        relations: ['user'],
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: '레시피를 찾을 수 없습니다.',
        });
      }

      let parentComment: Comment | null = null;
      if (parent_comment_id) {
        parentComment = await commentRepository.findOne({
          where: { comment_id: parent_comment_id, recipe_post_id, delete_yn: false },
        });
        if (!parentComment) {
          return res.status(404).json({
            success: false,
            message: '원본 댓글을 찾을 수 없습니다.',
          });
        }
      }

      let createdCommentId: string | null = null;

      await AppDataSource.transaction(async transactionalEntityManager => {
        const transactionalCommentRepo = transactionalEntityManager.getRepository(Comment);
        const commentEntity = transactionalCommentRepo.create({
          recipe_post_id,
          user_id: userId,
          parent_comment_id: parentComment ? parentComment.comment_id : undefined,
          content: trimmedContent,
        });

        const saved = await transactionalCommentRepo.save(commentEntity as any);
        createdCommentId = (saved as Comment).comment_id;

        await transactionalEntityManager
          .createQueryBuilder()
          .update(RecipePost)
          .set({ comment_count: () => 'COALESCE(comment_count, 0) + 1' })
          .where('recipe_post_id = :recipe_post_id', { recipe_post_id })
          .execute();
      });

      // 레시피 정보 재조회 (트랜잭션 후 업데이트된 comment_count 포함)
      const updatedRecipe = await recipeRepository.findOne({
        where: { recipe_post_id },
        select: ['recipe_post_id', 'user_id', 'comment_count'],
      });

      // 타이틀 체크 및 알림 생성 (비동기 처리)
      if (updatedRecipe?.user_id && userId && recipe_post_id) {
        // 레시피 작성자에게 댓글 받음 타이틀 체크
        TitleService.checkTitleOnCommentReceived(updatedRecipe.user_id, recipe_post_id).catch((error: any) => {
          console.error('❌ [타이틀 체크] 댓글 받음 후 타이틀 체크 오류:', error);
        });

        // 댓글을 작성한 사용자에게 댓글러 타이틀 체크
        TitleService.checkTitleOnCommentWritten(userId).catch((error: any) => {
          console.error('❌ [타이틀 체크] 댓글 작성 후 타이틀 체크 오류:', error);
        });

        // 알림 및 타이틀 체크 (Promise.all 병렬 처리)
        if (updatedRecipe.user_id !== userId) {
          Promise.all([
            TitleService.checkTitleOnCommentReceived(updatedRecipe.user_id, recipe_post_id).catch(e => console.error(e)),
            TitleService.checkTitleOnCommentWritten(userId).catch(e => console.error(e)),
            NotificationController.createNotification(updatedRecipe.user_id, userId, 'NEW_COMMENT', recipe_post_id).catch(e => console.error(e))
          ]).catch(e => console.error('Async task error:', e));
        } else {
          // 자기 자신인 경우 타이틀 체크만
          Promise.all([
            TitleService.checkTitleOnCommentReceived(updatedRecipe.user_id, recipe_post_id).catch(e => console.error(e)),
            TitleService.checkTitleOnCommentWritten(userId).catch(e => console.error(e))
          ]).catch(e => console.error('Async task error:', e));
        }
      }

      const savedComment = await commentRepository.findOne({
        where: { comment_id: createdCommentId! },
        relations: ['user'],
      });

      const formatted = RecipeController.formatComment(savedComment!);

      return res.status(201).json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      return res.status(500).json({
        success: false,
        message: '댓글 작성 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 최근 한 달 내 랜덤 레시피 조회
   * GET /api/recipes/recent-random
   */
  static async getRecentRandomRecipes(req: Request, res: Response) {
    try {
      const limit = Math.min(Number(req.query.limit) || 12, 50);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const recipes = await AppDataSource.getRepository(RecipePost)
        .createQueryBuilder('recipe')
        .leftJoin('recipe.images', 'image')
        .select('recipe.recipe_post_id', 'recipe_post_id')
        .addSelect('recipe.title', 'title')
        .addSelect('MIN(image.image_url)', 'thumbnail')
        .where('recipe.delete_yn = false')
        .andWhere('recipe.is_default = false')
        .andWhere('recipe.created_at >= :oneMonthAgo', { oneMonthAgo })
        .groupBy('recipe.recipe_post_id')
        .addGroupBy('recipe.title')
        .orderBy('RANDOM()')
        .limit(limit)
        .getRawMany();

      const formatted = recipes.map((row: any) => ({
        recipe_post_id: row.recipe_post_id,
        title: row.title,
        thumbnail: normalizeImageUrl(row.thumbnail) || null,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error('❌ [RecipeController] 최근 랜덤 레시피 조회 실패:', error);
      return res.status(500).json({
        success: false,
        message: '최근 레시피를 불러오지 못했습니다.',
      });
    }
  }

  /**
   * 웹 검색을 통해 레시피 정보 가져오기
   * 최신 유행 레시피나 AI가 모르는 레시피에 대한 정보를 수집
   */
  private static async searchRecipeOnWeb(recipeName: string): Promise<string | null> {
    try {
      console.log(`🔍 [RecipeController] 웹 검색 시작: "${recipeName}"`);

      // Google Custom Search API를 사용하는 경우
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

      if (googleApiKey && googleSearchEngineId) {
        // Google Custom Search API 사용
        const searchUrl = `https://www.googleapis.com/customsearch/v1`;
        const params = {
          key: googleApiKey,
          cx: googleSearchEngineId,
          q: `${recipeName} 레시피 재료 만드는법`,
          num: 3, // 상위 3개 결과만
          lr: 'lang_ko', // 한국어 우선
        };

        const response = await axios.get(searchUrl, { params, timeout: 5000 });

        if (response.data.items && response.data.items.length > 0) {
          // 검색 결과에서 스니펫(요약) 추출
          const snippets = response.data.items
            .map((item: any) => item.snippet)
            .filter((snippet: string) => snippet && snippet.length > 0)
            .join('\n\n');

          console.log(`✅ [RecipeController] 웹 검색 완료: ${response.data.items.length}개 결과`);
          return snippets;
        }
      }

      // API가 설정되지 않은 경우: 간단한 HTTP 요청으로 레시피 사이트 검색
      // (이 방법은 제한적이지만 API 키 없이도 작동)
      console.log('⚠️ [RecipeController] Google Search API 미설정. 웹 검색 건너뜀.');
      return null;

    } catch (error: any) {
      console.error('❌ [RecipeController] 웹 검색 실패:', error.message);
      return null; // 검색 실패해도 계속 진행
    }
  }

  /**
   * AI 쉐프 이미지 분석
   * POST /api/recipes/ai-analyze
   * AWS Bedrock Claude 3.5 Sonnet을 사용하여 이미지를 분석하고 레시피 정보를 추출합니다.
   */
  static async analyzeImageWithAI(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const { image_base64, main_ingredient_names, recipe_name } = req.body;

      if (!image_base64) {
        return res.status(400).json({
          success: false,
          message: '이미지가 필요합니다.',
        });
      }


      // ============================================================
      // 이미지 리사이징 (Bedrock API 제한: 최대 8000픽셀)
      // ============================================================
      let resizedImageBase64: string;
      try {
        // base64 디코딩
        const imageBuffer = Buffer.from(image_base64, 'base64');

        // 이미지 메타데이터 확인
        const metadata = await sharp(imageBuffer).metadata();
        const { width = 0, height = 0 } = metadata;

        // 최대 크기 제한: 4000픽셀 (Bedrock 제한 8000픽셀의 절반으로 안전하게 설정)
        const MAX_DIMENSION = 4000;

        let resizedBuffer: Buffer;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          // 비율 유지하면서 리사이징
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          const newWidth = Math.round(width * ratio);
          const newHeight = Math.round(height * ratio);

          console.log(`🔄 [RecipeController] 이미지 리사이징: ${width}x${height} -> ${newWidth}x${newHeight}`);

          resizedBuffer = await sharp(imageBuffer)
            .rotate() // EXIF 방향 정보를 자동으로 적용하여 올바른 방향으로 회전
            .resize(newWidth, newHeight, {
              fit: 'inside',
              withoutEnlargement: true,
              fastShrinkOnLoad: true, // 빠른 축소 처리
            })
            .jpeg({
              quality: 85,
              mozjpeg: true,
              progressive: true, // 점진적 JPEG 로딩 (웹 성능 향상)
              optimizeScans: true, // 스캔 최적화
            })
            .toBuffer();
        } else {
          // 이미 작으면 JPEG로 변환만 (압축)
          resizedBuffer = await sharp(imageBuffer)
            .rotate() // EXIF 방향 정보를 자동으로 적용하여 올바른 방향으로 회전
            .jpeg({
              quality: 85,
              mozjpeg: true,
              progressive: true, // 점진적 JPEG 로딩 (웹 성능 향상)
              optimizeScans: true, // 스캔 최적화
            })
            .toBuffer();
        }

        // base64로 인코딩
        resizedImageBase64 = resizedBuffer.toString('base64');

        const originalSize = imageBuffer.length;
        const resizedSize = resizedBuffer.length;
        console.log(`✅ [RecipeController] 이미지 리사이징 완료: ${(originalSize / 1024).toFixed(2)}KB -> ${(resizedSize / 1024).toFixed(2)}KB`);
      } catch (resizeError: any) {
        console.error('❌ [RecipeController] 이미지 리사이징 실패:', resizeError);
        // 리사이징 실패 시 원본 사용 (에러 발생 가능하지만 시도)
        resizedImageBase64 = image_base64;
      }

      // ============================================================
      // AWS Bedrock 인증 설정
      // ============================================================
      // 서울 리전(ap-northeast-2) 사용 권장 - 한국 사용자에게 가장 빠른 응답 속도
      const region = process.env.AWS_REGION || 'ap-northeast-2';

      // Bedrock 장기 API Key 확인
      // 표준 환경 변수: AWS_BEARER_TOKEN_BEDROCK (권장)
      // 호환성 환경 변수: AWS_BEDROCK_API_KEY (하위 호환)
      const bedrockApiKey = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEDROCK_API_KEY;

      // IAM 자격 증명 확인
      const hasIamCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

      // 인증 정보 확인
      if (!bedrockApiKey && !hasIamCredentials) {
        return res.status(500).json({
          success: false,
          message: 'AWS 인증 정보가 설정되지 않았습니다. Bedrock API Key (AWS_BEARER_TOKEN_BEDROCK) 또는 IAM 자격 증명이 필요합니다.',
        });
      }

      // ============================================================
      // 사용자 입력 검증 및 보안 처리
      // ============================================================
      // 요리 이름 검증: 프롬프트 인젝션 방지
      let sanitizedRecipeName = '';
      if (recipe_name && typeof recipe_name === 'string') {
        const trimmed = recipe_name.trim();

        // 1. 길이 제한 (최대 30자)
        if (trimmed.length > 30) {
          console.warn('⚠️ [RecipeController] 요리 이름이 너무 깁니다. 30자로 자릅니다.');
          sanitizedRecipeName = trimmed.substring(0, 30);
        } else {
          sanitizedRecipeName = trimmed;
        }

        // 2. 허용되지 않는 문자 필터링 (한글, 영문, 숫자, 공백, 일부 특수문자만 허용)
        const allowedPattern = /^[가-힣a-zA-Z0-9\s\-_.()]+$/;
        if (!allowedPattern.test(sanitizedRecipeName)) {
          console.warn('⚠️ [RecipeController] 요리 이름에 허용되지 않는 문자가 포함되어 있습니다. 필터링합니다.');
          sanitizedRecipeName = sanitizedRecipeName.replace(/[^가-힣a-zA-Z0-9\s\-_.()]/g, '');
        }

        // 3. 프롬프트 인젝션 의심 키워드 검사 (영어/한글)
        const suspiciousKeywords = [
          'ignore', 'disregard', 'forget', 'override', 'system', 'instruction', 'prompt', 'role',
          'assistant', 'AI', 'model', 'you are', 'act as', 'pretend', 'instead', 'however',
          '무시', '잊어', '대신', '시스템', '명령', '지시', '역할', '프롬프트',
        ];

        const lowerCaseName = sanitizedRecipeName.toLowerCase();
        for (const keyword of suspiciousKeywords) {
          if (lowerCaseName.includes(keyword.toLowerCase())) {
            console.error('❌ [RecipeController] 요리 이름에 의심스러운 키워드가 포함되어 있습니다:', keyword);
            return res.status(400).json({
              success: false,
              message: '요리 이름에 허용되지 않는 단어가 포함되어 있습니다. 실제 요리 이름만 입력해주세요.',
            });
          }
        }

        console.log('✅ [RecipeController] 요리 이름 검증 통과:', sanitizedRecipeName);
      }

      // 주재료 검증: 배열 길이 제한 및 문자열 검증
      const sanitizedMainIngredients = Array.isArray(main_ingredient_names) && main_ingredient_names.length > 0
        ? main_ingredient_names
          .filter((name: any) => typeof name === 'string' && name.trim().length > 0)
          .slice(0, 10) // 최대 10개로 제한
          .map((name: string) => name.trim().substring(0, 20)) // 각 재료 이름 최대 20자로 제한
        : [];

      // ============================================================
      // [알파 테스트] 웹 검색: 레시피 이름이 있으면 무조건 검색
      // 목적: AI가 실제로 검색 결과를 사용하는지 검증
      // ============================================================
      let webRecipeInfo: string | null = null;
      if (sanitizedRecipeName) {
        console.log(`🔍 [알파 테스트] 레시피 "${sanitizedRecipeName}" 무조건 검색 시작`);
        webRecipeInfo = await RecipeController.searchRecipeOnWeb(sanitizedRecipeName);
        if (webRecipeInfo) {
          console.log(`✅ [알파 테스트] 웹 검색 결과 획득 (${webRecipeInfo.length}자)`);
        } else {
          console.log(`⚠️ [알파 테스트] 웹 검색 결과 없음`);
        }
      }

      // ============================================================
      // 프롬프트 구성 (개선됨)
      // ============================================================
      // 사용자 입력과 이미지 분석을 함께 고려하는 방식
      let prompt = `당신은 가정 요리 레시피 분석 전문 AI입니다. 사용자가 직접 만든 가정식 요리 사진을 분석하여 레시피를 작성합니다.`;

      // 요리 이름이 제공된 경우: 사용자 입력과 이미지를 함께 고려
      if (sanitizedRecipeName) {
        prompt += `\n\n**[분석 방법]**

사용자가 입력한 요리 이름: "${sanitizedRecipeName}"

**중요: 사용자 입력과 이미지를 함께 고려하여 분석하세요.**

1. **우선 순위:**
   - 사용자가 입력한 요리 이름 "${sanitizedRecipeName}"를 기준으로 레시피를 작성합니다.
   - 이미지는 해당 요리의 구체적인 재료, 비율, 조리 상태를 파악하는데 사용합니다.

2. **이미지 검증 (음식 여부만 확인):**
   
   ✅ **허용되는 경우:**
   - 이미지에 음식이 보이는 경우 → 모두 허용
   - 사용자가 입력한 "${sanitizedRecipeName}"의 레시피를 작성하되, 이미지의 재료/스타일을 반영합니다.
   
   ❌ **거부해야 하는 경우:**
   - 이미지에 음식이 전혀 없는 경우 (풍경, 사람, 동물, 물건 등)
   - 이 경우에만 에러 반환: {"error": true, "message": "이미지에서 음식을 찾을 수 없습니다. 음식 사진을 업로드해주세요."}

3. **레시피 작성 방법:**
   - 요리 이름: "${sanitizedRecipeName}" 사용 (또는 더 구체적인 변형, 예: "두바이 쫀득 쿠키" → "두바이 초콜릿 쿠키")
   - 재료: 이미지에서 보이는 실제 재료를 "${sanitizedRecipeName}"에 맞게 해석하여 작성
   - 조리법: "${sanitizedRecipeName}"의 일반적인 레시피를 기반으로 하되, 이미지의 특징을 반영
   
   **예시:**
   - 입력: "두바이 쫀득 쿠키" + 초콜릿 쿠키 사진 
     → "두바이 쫀득 쿠키" 레시피 작성 (이미지에서 보이는 초콜릿, 견과류 등을 재료에 포함)
   - 입력: "불고기" + 고기 볶음 사진
     → "불고기" 레시피 작성 (이미지에서 보이는 야채, 고기 종류 등을 재료에 포함)`;
        console.log('📝 [RecipeController] 요리 이름 기반 프롬프트 추가:', sanitizedRecipeName);

        // [알파 테스트] 웹 검색 결과를 프롬프트에 포함
        if (webRecipeInfo) {
          prompt += `\n\n**[알파 테스트: 웹 검색 결과 - 반드시 참고]**

다음은 "${sanitizedRecipeName}"에 대한 최신 웹 검색 결과입니다.
이 정보를 **반드시 참고**하여 정확한 레시피를 작성하세요.

${webRecipeInfo}

**중요 지침:**
1. 위 검색 결과에서 언급된 주요 재료를 레시피에 포함해야 합니다
2. 검색 결과의 조리법을 참고하되, 이미지에 보이는 실제 재료와 조리 상태도 함께 고려하세요
3. 검색 결과를 무시하지 말고, 이를 바탕으로 정확한 레시피를 작성하세요`;
          console.log('✅ [알파 테스트] 웹 검색 결과를 프롬프트에 포함');
        }
      }

      // 주재료 정보 제공
      if (sanitizedMainIngredients.length > 0) {
        const mainIngredientsText = sanitizedMainIngredients.join(', ');
        prompt += `\n\n**[${sanitizedRecipeName ? '2' : '1'}단계: 주재료 정보]**

사용된 주재료: ${mainIngredientsText}

⚠️ 중요: 위에 나열된 모든 주재료는 반드시 레시피의 재료 목록(ingredients)에 포함되어야 합니다. 
이는 필수 요구사항이며, 누락될 경우 레시피가 거부됩니다.

주재료를 포함하는 방법:
- 주재료 이름을 정확히 사용하세요 (예: "돼지고기" 선택 시 "돼지고기", "삼겹살", "목살" 등으로 표현 가능)
- 각 주재료의 적절한 수량과 단위를 명시하세요
- 이미지에서 주재료가 명확히 보이지 않더라도 사용자가 선택했다면 반드시 포함하세요`;
        console.log('📝 [RecipeController] 주재료 정보 프롬프트에 추가:', mainIngredientsText);
      }

      prompt += `\n\n**[레시피 작성 요구사항]**

제공된 이미지를 분석하여 다음 정보를 JSON 형식으로 반환해주세요:

1. **title**: 요리 이름 (한국어)
   - **사용자가 입력한 요리 이름을 우선적으로 사용**하세요.
   - 이미지는 해당 요리의 구체적인 스타일이나 변형을 파악하는 데 사용합니다.
   - 예: 사용자 입력이 "두바이 쫀득 쿠키"이고 초콜릿 쿠키 사진이면 → "두바이 쫀득 쿠키" 또는 "두바이 초콜릿 쿠키"

2. **description**: 요리에 대한 한 줄 요약 (한국어, 50자 이내)
   - 이 요리의 특징과 맛을 간단히 설명하세요.

3. **ingredients**: 재료 배열 (1인분 기준)
   - 각 재료는 다음 형식으로 작성:
     {
       "name": "재료 이름 (한국어)",
       "quantity": 수량 (숫자, 소수점 가능),
       "unit": "단위 (g, ml, 개, 큰술, 작은술, 꼬집 등)"
     }
   - **[필수]** 사용자가 선택한 모든 주재료는 반드시 재료 목록에 포함되어야 합니다.
   - 주재료 이름을 정확히 사용하되, 유사한 표현도 허용됩니다 (예: "돼지고기" → "삼겹살" 가능)
   - 이미지에서 실제로 보이는 다른 재료들도 포함하세요.
   - 양념, 소스, 드레싱 등의 모든 부재료도 구체적으로 나열하세요.

4. **recipe_steps**: 레시피 단계 배열
   - 각 단계는 다음 형식으로 작성:
     {
       "step_number": 단계 번호 (1부터 시작),
       "instruction": "단계별 설명 (한국어, 구체적이고 명확하게)"
     }
   - 일반 가정에서 실제로 따라할 수 있는 보편적이고 실용적인 조리법을 작성하세요.
   - "~를 바릅니다", "~를 넣습니다"라고만 하지 말고, 그 재료를 어떻게 준비하는지 구체적으로 설명하세요.
   
**중요 작성 규칙:**

1. **보편적인 레시피 작성:**
   - 일반 가정에서 쉽게 따라할 수 있는 표준적인 조리법을 작성하세요.
   - 특별한 기술이나 장비가 필요한 조리법은 피하세요.
   - 한국의 일반적인 가정식 조리법을 기준으로 작성하세요.

2. **소스/양념 제조법 명시:**
   - "소스를 바릅니다", "양념을 넣습니다"라고만 하지 마세요.
   - 소스나 양념이 필요한 경우, 그것을 만드는 방법을 별도의 단계로 구체적으로 설명하세요.
   - 예시: "간장 2큰술, 설탕 1큰술, 다진 마늘 1작은술을 섞어 양념장을 만듭니다" → "준비한 양념장을 고기에 바릅니다"
   
3. **조리 과정의 구체성:**
   - 조리 시간 (예: "중불에서 5분간 볶습니다")
   - 조리 방법 (예: "재료가 투명해질 때까지 볶습니다")
   - 불의 세기 (예: "센불", "중불", "약불")
   - 조리 상태 확인 방법 (예: "젓가락으로 찔러 육즙이 투명하게 나오면 익은 것입니다")

4. **재료의 정확성:**
   - **[필수]** 사용자가 선택한 모든 주재료는 반드시 재료 목록에 포함해야 합니다.
   - 주재료는 정확한 이름 또는 유사한 표현으로 포함하세요 (예: "돼지고기" → "삼겹살", "목살" 등 가능)
   - 이미지에서 실제로 보이는 다른 재료들도 포함하세요.
   - 이미지에 없는 고급 재료(트러플, 캐비어, 샤프란 등)를 창조하지 마세요.
   - 대체 재료가 필요하다면, 이미지에 있는 재료만 사용하세요.

**안전 규칙 (반드시 준수):**

1. **위험한 재료/조리법 금지:**
   - 독성이 있는 재료 절대 금지: 감자 싹, 녹색 감자 껍질, 독버섯, 복어 내장 등
   - 식중독 위험이 있는 조리법 금지: 닭고기/돼지고기를 덜 익히는 방법, 날달걀을 과도하게 사용하는 방법
   - 반드시 충분히 익혀야 하는 식재료: 닭고기, 돼지고기, 해산물 (완전히 익혀야 함을 명시)

2. **에러 처리:**
   - 이미지에 **음식이 전혀 없으면** 다음과 같이 에러를 반환하세요:
     {"error": true, "message": "이미지에서 음식을 찾을 수 없습니다. 음식 사진을 업로드해주세요."}

**응답 형식:**

JSON 형식만 반환하고, 추가 설명이나 마크다운은 포함하지 마세요. 모든 텍스트는 한국어로 작성하세요.`;

      // 요리 이름/주재료가 없는 경우 추가 안내
      if (!sanitizedRecipeName && sanitizedMainIngredients.length === 0) {
        prompt += `\n\n참고: 사용자가 요리 이름이나 주재료 정보를 제공하지 않았으므로, 이미지만을 보고 요리를 판단해야 합니다. 이미지에서 명확하게 보이는 요리를 분석하세요.`;
      }

      prompt += `\n\n응답 형식 (JSON만):
{
  "title": "요리 이름",
  "description": "한 줄 요약",
  "ingredients": [
    {"name": "재료1", "quantity": 100, "unit": "g"},
    {"name": "재료2", "quantity": 2, "unit": "개"}
  ],
  "recipe_steps": [
    {"step_number": 1, "instruction": "첫 번째 단계 설명"},
    {"step_number": 2, "instruction": "두 번째 단계 설명"}
  ]
}`;

      // Claude 3.5 Sonnet 모델 호출
      // API Key 사용 시: 교차 리전 모델 ID (apac.*) 또는 inference profile ID 사용
      // IAM 자격 증명 사용 시: 모델 ID 직접 사용 가능
      // 교차 리전 모델 ID 형식: apac.anthropic.claude-3-5-sonnet-20240620-v1:0
      // 일반 모델 ID 형식: anthropic.claude-3-5-sonnet-20241022-v2:0
      const modelId = process.env.AWS_BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20240620-v1:0';

      // API Key 사용 시 inference profile ID (환경 변수에서 가져오거나 기본값 사용)
      // inference profile이 없으면 교차 리전 모델 ID를 직접 사용
      const inferenceProfileId = process.env.AWS_BEDROCK_INFERENCE_PROFILE_ID;

      // 교차 리전 모델 ID 확인 (apac.* 형식)
      const isCrossRegionModelId = modelId.startsWith('apac.') || modelId.startsWith('us.') || modelId.startsWith('eu.');

      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: resizedImageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      };

      // ============================================================
      // AWS Bedrock 모델 호출
      // ============================================================
      let responseBody: any;

      if (bedrockApiKey) {
        // ============================================================
        // 방법 1: Bedrock 장기 API Key 사용 (권장)
        // ============================================================
        // AWS Bedrock 장기 API Key는 Authorization: Bearer 헤더를 사용
        // 서명(Signing) 없이 직접 HTTP 요청 전송
        // API Key 사용 시: inference profile ID 또는 교차 리전 모델 ID 사용
        let endpoint: string;

        if (inferenceProfileId) {
          // Inference Profile 사용 (API Key 권장 방식)
          endpoint = `https://bedrock-runtime.${region}.amazonaws.com/inference-profile/${inferenceProfileId}/invoke`;
        } else if (isCrossRegionModelId) {
          // 교차 리전 모델 ID 사용 (apac.*, us.*, eu.* 형식)
          // 교차 리전 모델 ID는 API Key와 함께 사용 가능
          endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;
        } else {
          // 일반 모델 ID 직접 사용 (일부 리전에서는 작동하지 않을 수 있음)
          endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;
        }

        // AI 분석 시작 로그 (간단하게)
        console.log('🤖 [RecipeController] AI 이미지 분석 시작 (Bedrock API Key 사용)');

        responseBody = await new Promise((resolve, reject) => {
          const url = new URL(endpoint);
          const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${bedrockApiKey}`,
            },
          };

          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(data));
                } catch (e) {
                  reject(new Error(`응답 파싱 실패: ${e}`));
                }
              } else {
                try {
                  const errorData = JSON.parse(data);
                  const errorMessage = errorData.message || errorData.__type || data;
                  reject(new Error(`HTTP ${res.statusCode}: ${errorMessage}`));
                } catch {
                  reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
              }
            });
          });

          req.on('error', (error) => {
            reject(error);
          });

          req.write(JSON.stringify(requestBody));
          req.end();
        });
      } else {
        // ============================================================
        // 방법 2: IAM 자격 증명 사용
        // ============================================================
        // AWS SDK를 사용하여 서명된 요청 전송
        const bedrockClientConfig: any = {
          region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        };
        const bedrockClient = new BedrockRuntimeClient(bedrockClientConfig);

        const input = {
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody),
        };
        const command = new InvokeModelCommand(input);
        const response = await bedrockClient.send(command);
        responseBody = JSON.parse(new TextDecoder().decode(response.body));
      }

      // ============================================================
      // 응답 처리 및 도구 사용(Tool Use) 핸들링
      // ============================================================\n      console.log('✅ [RecipeController] AI 이미지 분석 완료');

      // 응답 파싱
      const textContent = responseBody.content?.find((item: any) => item.type === 'text');
      if (!textContent) {
        throw new Error('AI 응답에서 텍스트를 찾을 수 없습니다.');
      }
      const content = textContent.text;

      // JSON 추출 (마크다운 코드 블록 및 기타 불필요한 텍스트 제거)
      let jsonText = content.trim();

      // 마크다운 코드 블록 제거
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // JSON 시작 위치 찾기 (중괄호 또는 대괄호로 시작)
      const jsonStartMatch = jsonText.match(/[{\[]/);
      if (jsonStartMatch && jsonStartMatch.index && jsonStartMatch.index > 0) {
        jsonText = jsonText.substring(jsonText.indexOf(jsonStartMatch[0]));
      }

      // JSON 끝 위치 찾기 (마지막 중괄호 또는 대괄호)
      const jsonEndMatch = jsonText.match(/[}\]]\s*$/);
      if (jsonEndMatch && jsonEndMatch.index !== undefined) {
        jsonText = jsonText.substring(0, jsonEndMatch.index + 1);
      }

      // 후행 쉼표 제거 (JSON 표준에서 허용되지 않음)
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

      // JSON 파싱 전에 내용 확인 및 로그
      console.log('📋 [RecipeController] JSON 파싱 시도. 텍스트 길이:', jsonText.length);
      console.log('📋 [RecipeController] JSON 텍스트 미리보기:', jsonText.substring(0, 300));

      let analysisResult;
      try {
        analysisResult = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error('❌ [RecipeController] AI 이미지 분석 실패:', parseError.message);
        console.error('❌ [RecipeController] 파싱 실패한 JSON 텍스트:', jsonText);

        // JSON 파싱 에러의 위치 정보 추출
        const positionMatch = parseError.message.match(/position (\d+)/);
        if (positionMatch) {
          const position = parseInt(positionMatch[1]);
          const errorContext = jsonText.substring(Math.max(0, position - 50), Math.min(jsonText.length, position + 50));
          console.error('❌ [RecipeController] 에러 발생 위치 컨텍스트:', errorContext);
        }

        return res.status(500).json({
          success: false,
          message: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.',
          error: parseError.message,
        });
      }

      // 음식이 아니라는 판단이 있는 경우
      if (analysisResult.error || analysisResult.message) {
        return res.status(400).json({
          success: false,
          message: analysisResult.message || '이미지에서 요리를 인식할 수 없습니다.',
        });
      }

      // ============================================================
      // AI 응답 검증: 환각(Hallucination) 및 안전성 체크
      // ============================================================
      const validationResult = RecipeController.validateAIResponse(analysisResult, sanitizedRecipeName, sanitizedMainIngredients);
      if (!validationResult.valid) {
        console.error('❌ [RecipeController] AI 응답 검증 실패:', validationResult.errors);
        return res.status(400).json({
          success: false,
          message: validationResult.message || 'AI 분석 결과에 문제가 있습니다. 다시 시도해주세요.',
          errors: validationResult.errors,
        });
      }
      console.log('✅ [RecipeController] AI 응답 검증 통과');

      // 응답 형식 검증 및 변환
      const title = analysisResult.title || '';
      const description = analysisResult.description || '';
      const recipe_steps = (analysisResult.recipe_steps || []).map((step: any) => ({
        step_number: typeof step.step_number === 'number' ? step.step_number : parseInt(step.step_number) || 1,
        instruction: step.instruction || '',
      }));

      // ============================================================
      // 재료 처리: AI 분석 결과의 재료를 찾거나 생성하고 ID를 포함하여 반환
      // ============================================================
      const ingredientRepository = AppDataSource.getRepository(Ingredient);
      const processedIngredients = [];

      for (const ing of analysisResult.ingredients || []) {
        const ingredientName = (ing.name || '').trim();
        if (!ingredientName) {
          console.warn('⚠️ [RecipeController] 빈 재료 이름 건너뛰기');
          continue;
        }

        const quantity = typeof ing.quantity === 'number' ? ing.quantity : parseFloat(ing.quantity) || 0;
        const unit = (ing.unit || '개').trim();

        console.log(`🔍 [RecipeController] 재료 처리 시작: "${ingredientName}" (${quantity}${unit})`);

        // 먼저 현재 사용자의 재료 중에서 찾기
        let foundIngredient = await ingredientRepository.findOne({
          where: {
            name: ingredientName,
            user_id: userId,
          },
        });

        // 사용자 재료에서 못 찾으면 공통 재료(user_id가 NULL)에서 찾기
        if (!foundIngredient) {
          foundIngredient = await ingredientRepository.findOne({
            where: {
              name: ingredientName,
              user_id: IsNull(),
            },
          });
        }

        if (foundIngredient) {
          // 기존 재료를 찾았으면 unit만 업데이트 (default_unit이 없거나 다를 경우)
          if (unit && foundIngredient.default_unit !== unit) {
            foundIngredient.default_unit = unit;
            await ingredientRepository.save(foundIngredient);
            console.log(`✅ [RecipeController] 기존 재료 unit 업데이트: ${foundIngredient.ingredient_id} - ${foundIngredient.name} (${unit})`);
          } else {
            console.log(`✅ [RecipeController] 기존 재료 사용: ${foundIngredient.ingredient_id} - ${foundIngredient.name}`);
          }

          processedIngredients.push({
            ingredient_id: foundIngredient.ingredient_id,
            name: foundIngredient.name,
            quantity: quantity,
            unit: unit,
          });
        } else {
          // 재료가 없으면 새로 생성
          const newIngredient = ingredientRepository.create({
            name: ingredientName,
            user_id: userId, // 현재 사용자의 재료로 생성
            default_unit: unit,
          });
          const savedIngredient = await ingredientRepository.save(newIngredient);
          console.log(`✨ [RecipeController] 새 재료 생성: ${savedIngredient.ingredient_id} - ${savedIngredient.name} (${unit})`);

          processedIngredients.push({
            ingredient_id: savedIngredient.ingredient_id,
            name: savedIngredient.name,
            quantity: quantity,
            unit: unit,
          });
        }
      }

      const formattedResult = {
        title,
        description,
        ingredients: processedIngredients,
        recipe_steps,
      };

      console.log('📤 [RecipeController] AI 분석 결과 반환:', {
        title,
        description,
        ingredients_count: processedIngredients.length,
        ingredients: processedIngredients.map(ing => ({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
        recipe_steps_count: recipe_steps.length,
      });

      return res.json({
        success: true,
        data: formattedResult,
      });
    } catch (error: any) {
      console.error('❌ [RecipeController] AI 이미지 분석 실패:', error);

      // 에러 메시지 처리
      let errorMessage = 'AI 분석 중 오류가 발생했습니다.';
      if (error.message?.includes('Invalid image')) {
        errorMessage = '유효하지 않은 이미지입니다.';
      } else if (error.message?.includes('not a food') || error.message?.includes('not food')) {
        errorMessage = '이미지에서 요리를 인식할 수 없습니다.';
      } else if (error.message?.includes('AWS') || error.message?.includes('credentials')) {
        errorMessage = 'AWS 설정 오류가 발생했습니다.';
      }

      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}
