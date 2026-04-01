import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {
  RecipePost,
  RecipeRelation,
  RecipePostImage,
  MainIngredient,
  Ingredient,
} from '../models/Post';
import {User} from '../models/User';

/**
 * 지도 관련 컨트롤러
 */
export class MapController {
  /**
   * 지도 범위 내 레시피 조회
   * GET /api/maps/recipes
   */
  static async getMapRecipes(req: Request, res: Response) {
    try {
      const {
        min_latitude,
        max_latitude,
        min_longitude,
        max_longitude,
        latitude,
        longitude,
        radius = '2000',
      } = req.query;

      const hasBounds =
        min_latitude !== undefined &&
        max_latitude !== undefined &&
        min_longitude !== undefined &&
        max_longitude !== undefined;

      if (!hasBounds && (!latitude || !longitude)) {
        return res.status(400).json({
          success: false,
          message: '지도 영역 또는 중심 좌표가 필요합니다.',
        });
      }

      const query = AppDataSource.createQueryBuilder()
        .from(RecipePost, 'post')
        .leftJoin(
          RecipeRelation,
          'relation',
          'relation.recipe_post_id = post.recipe_post_id AND relation.type = 2',
        )
        .leftJoin(
          MainIngredient,
          'mainIngredient',
          'mainIngredient.main_ingredient_id = relation.child_id',
        )
        .leftJoin(
          Ingredient,
          'ingredient',
          'ingredient.ingredient_id = mainIngredient.ingredient_id',
        )
        .leftJoin(
          RecipePostImage,
          'image',
          'image.recipe_post_id = post.recipe_post_id',
        )
        .leftJoin(User, 'user', 'user.user_id = post.user_id')
        .select('post.recipe_post_id', 'recipe_post_id')
        .addSelect('post.title', 'title')
        .addSelect('post.description', 'description')
        .addSelect('post.like_count', 'like_count')
        .addSelect('post.comment_count', 'comment_count')
        .addSelect('post.user_id', 'user_id')
        .addSelect('user.nickname', 'nickname')
        .addSelect('user.profile_image_url', 'profile_image_url')
        .addSelect('STRING_AGG(DISTINCT ingredient.name, \', \')', 'main_ingredient_name')
        .addSelect('MIN(image.image_url)', 'represent_photo_url')
        .addSelect('ST_Y(post.location::geometry)', 'latitude')
        .addSelect('ST_X(post.location::geometry)', 'longitude')
        .addSelect('0', 'view_count')
        .where('post.delete_yn = :deleteYn', {deleteYn: false})
        .andWhere('post.is_default = :isDefault', {isDefault: false})
        .andWhere('post.location IS NOT NULL')
        .groupBy('post.recipe_post_id')
        .addGroupBy('post.title')
        .addGroupBy('post.description')
        .addGroupBy('post.like_count')
        .addGroupBy('post.comment_count')
        .addGroupBy('post.user_id')
        .addGroupBy('user.nickname')
        .addGroupBy('user.profile_image_url');

      if (hasBounds) {
        const minLat = Number(min_latitude);
        const maxLat = Number(max_latitude);
        const minLng = Number(min_longitude);
        const maxLng = Number(max_longitude);

        query.andWhere('ST_Y(post.location::geometry) BETWEEN :minLat AND :maxLat', {
          minLat,
          maxLat,
        });
        query.andWhere('ST_X(post.location::geometry) BETWEEN :minLng AND :maxLng', {
          minLng,
          maxLng,
        });
      } else if (latitude && longitude) {
        query.andWhere(
          `ST_DWithin(
            post.location,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
            :radius
          )`,
          {
            latitude: Number(latitude),
            longitude: Number(longitude),
            radius: Number(radius),
          },
        );
      }

      const rawResults = await query.getRawMany();

      const mapData = rawResults
        .map(row => ({
          recipe_post_id: row.recipe_post_id,
          title: row.title,
          description: row.description,
          nickname: row.nickname ?? '',
          user_id: row.user_id,
          profile_image_url: row.profile_image_url,
          main_ingredient_name: row.main_ingredient_name ?? '',
          represent_photo_url: row.represent_photo_url || null,
          latitude:
            row.latitude !== null && row.latitude !== undefined
              ? Number(row.latitude)
              : null,
          longitude:
            row.longitude !== null && row.longitude !== undefined
              ? Number(row.longitude)
              : null,
          like_count: row.like_count ? Number(row.like_count) : 0,
          comment_count: row.comment_count ? Number(row.comment_count) : 0,
        }))
        .filter(item => item.latitude !== null && item.longitude !== null);

      return res.json({
        success: true,
        data: mapData,
      });
    } catch (error) {
      console.error('지도 레시피 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '지도 정보를 불러오지 못했습니다.',
      });
    }
  }
}


