import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {Ingredient, MainIngredient} from '../models/Post';
import jwt from 'jsonwebtoken';

/**
 * 재료 컨트롤러
 * 재료 검색 및 추가 기능을 담당
 */
export class IngredientController {
  /**
   * 재료 검색
   * GET /api/ingredients/search?search_keyword=...
   */
  static async searchIngredients(req: Request, res: Response) {
    try {
      const {search_keyword} = req.query;
      
      // 선택적 인증: 토큰이 있으면 사용자 정보 추출
      let userId: string | undefined;
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
          userId = decoded.user_id;
        }
      } catch (error) {
        // 토큰이 없거나 유효하지 않으면 userId는 undefined로 유지
      }

      if (!search_keyword || typeof search_keyword !== 'string') {
        return res.json({
          success: true,
          data: [],
        });
      }

      const ingredientRepository = AppDataSource.getRepository(Ingredient);

      // 검색 쿼리 구성
      // user_id가 NULL인 공통 재료 또는 현재 사용자의 재료만 조회
      let query = ingredientRepository
        .createQueryBuilder('ingredient')
        .where('ingredient.name ILIKE :keyword', {
          keyword: `%${search_keyword}%`,
        });

      if (userId) {
        // 현재 사용자의 재료 또는 공통 재료(user_id가 NULL)만 조회
        query = query.andWhere(
          '(ingredient.user_id IS NULL OR ingredient.user_id = :userId)',
          {userId}
        );
      } else {
        // 로그인하지 않은 경우 공통 재료만 조회
        query = query.andWhere('ingredient.user_id IS NULL');
      }

      const ingredients = await query
        .orderBy('ingredient.name', 'ASC')
        .limit(20)
        .getMany();

      const formattedIngredients = ingredients.map(ing => ({
        ingredient_id: ing.ingredient_id,
        name: ing.name,
        default_unit: ing.default_unit || '',
      }));

      return res.json({
        success: true,
        data: formattedIngredients,
      });
    } catch (error) {
      console.error('재료 검색 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 재료 추가
   * POST /api/ingredients
   */
  static async createIngredient(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {name, sub_category_id, default_unit} = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '재료 이름은 필수입니다.',
        });
      }

      const ingredientRepository = AppDataSource.getRepository(Ingredient);

      // 동일한 이름의 재료가 이미 존재하는지 확인 (같은 사용자의 재료만)
      const existingIngredient = await ingredientRepository.findOne({
        where: {
          name: name.trim(),
          user_id: userId,
        },
      });

      if (existingIngredient) {
        return res.status(409).json({
          success: false,
          message: '이미 존재하는 재료입니다.',
        });
      }

      // 시퀀스 동기화 (ingredient_id 시퀀스가 테이블의 최대값과 맞지 않을 수 있음)
      try {
        await AppDataSource.query(`
          SELECT setval(
            pg_get_serial_sequence('ingredients', 'ingredient_id'),
            COALESCE((SELECT MAX(ingredient_id) FROM ingredients), 1),
            true
          );
        `);
      } catch (seqError) {
        console.warn('시퀀스 동기화 경고:', seqError);
        // 시퀀스 동기화 실패해도 계속 진행
      }

      // 새 재료 생성
      const newIngredient = ingredientRepository.create({
        name: name.trim(),
        sub_category_id: sub_category_id || null,
        user_id: userId,
        default_unit: default_unit || null,
      });

      const savedIngredient = await ingredientRepository.save(newIngredient);

      // main_ingredient 테이블에도 자동으로 등록
      // 이렇게 하면 사용자가 추가한 재료가 주재료 선택 목록에도 자동으로 나타남
      const mainIngredientRepository = AppDataSource.getRepository(MainIngredient);
      
      // 이미 main_ingredient에 등록된 재료인지 확인 (중복 방지)
      const existingMainIngredient = await mainIngredientRepository.findOne({
        where: {
          ingredient_id: savedIngredient.ingredient_id,
        },
      });

      let mainIngredientId: number | undefined;
      
      if (!existingMainIngredient) {
        // main_ingredient 시퀀스 동기화
        try {
          await AppDataSource.query(`
            SELECT setval(
              pg_get_serial_sequence('main_ingredient', 'main_ingredient_id'),
              COALESCE((SELECT MAX(main_ingredient_id) FROM main_ingredient), 1),
              true
            );
          `);
        } catch (seqError) {
          console.warn('main_ingredient 시퀀스 동기화 경고:', seqError);
        }

        // main_ingredient 테이블에 추가
        const newMainIngredient = mainIngredientRepository.create({
          ingredient_id: savedIngredient.ingredient_id,
        });

        const savedMainIngredient = await mainIngredientRepository.save(newMainIngredient);
        mainIngredientId = savedMainIngredient.main_ingredient_id;
        
        console.log(`✅ 재료 "${savedIngredient.name}"를 main_ingredient에 추가했습니다. (main_ingredient_id: ${mainIngredientId})`);
      } else {
        mainIngredientId = existingMainIngredient.main_ingredient_id;
        console.log(`ℹ️ 재료 "${savedIngredient.name}"는 이미 main_ingredient에 등록되어 있습니다. (main_ingredient_id: ${mainIngredientId})`);
      }

      return res.status(201).json({
        success: true,
        message: '재료가 성공적으로 추가되었습니다.',
        data: {
          ingredient_id: savedIngredient.ingredient_id,
          name: savedIngredient.name,
          sub_category_id: savedIngredient.sub_category_id,
          default_unit: savedIngredient.default_unit,
          main_ingredient_id: mainIngredientId, // 주재료 ID도 함께 반환
        },
      });
    } catch (error) {
      console.error('재료 추가 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }
}

