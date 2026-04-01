import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {Store, Promotion, Flyer, PromotionView} from '../models/Store';
import {Ingredient} from '../models/Post';
import {User} from '../models/User';
import {MoreThanOrEqual} from 'typeorm';
import {normalizeToRelativePath} from '../utils/imageUrl';

/**
 * 상점 컨트롤러
 * 상점 등록, 조회, 수정 등의 기능을 담당
 */
export class StoreController {
  /**
   * 상점 등록
   * POST /api/stores
   * 회원가입 중인 사용자도 등록할 수 있도록 user_id를 body에서도 받을 수 있음
   */
  static async createStore(req: Request, res: Response) {
    try {
      console.log('📝 [상점 등록] 컨트롤러 요청 받음');
      console.log('📝 [상점 등록] 요청 Body:', JSON.stringify(req.body, null, 2));

      // JWT에서 user_id 추출 (인증 미들웨어에서 설정됨) 또는 body에서 직접 받기
      const userId = (req as any).user?.user_id || req.body.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const {
        name,
        biz_reg_no,
        owner,
        address,
        detailed_address,
        phone_number,
        description,
        operating_hours,
        off_days,
        latitude,
        longitude,
        profile_image_url,
      } = req.body;

      // 필수 정보 검증
      if (!name || !biz_reg_no || !address) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다. (상점명, 사업자 등록번호, 주소)',
        });
      }

      // 사용자 확인
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

      // 사업자 등록번호 중복 확인
      const storeRepository = AppDataSource.getRepository(Store);
      const existingStore = await storeRepository.findOne({
        where: {biz_reg_no, user_id: userId},
      });

      if (existingStore) {
        return res.status(409).json({
          success: false,
          message: '이미 등록된 사업자 등록번호입니다.',
        });
      }

      // 주소 합치기 (상세 주소가 있으면 추가)
      const fullAddress = detailed_address ? `${address} ${detailed_address}` : address;

      // 위치 정보 생성
      let locationData: {type: 'Point'; coordinates: [number, number]} | undefined = undefined;
      if (latitude && longitude) {
        locationData = {
          type: 'Point',
          coordinates: [Number(longitude), Number(latitude)],
        };
      }

      // 상점 생성
      const newStore = storeRepository.create({
        user_id: userId,
        name,
        biz_reg_no,
        owner: owner || null,
        address: fullAddress,
        phone_number: phone_number || null,
        description: description || null,
        operating_hours: operating_hours || null,
        off_days: off_days || null,
        profile_image_url: normalizeToRelativePath(profile_image_url),
        location: locationData,
      });

      const savedStore = await storeRepository.save(newStore);
      console.log(`✅ [상점 등록] 상점 생성 완료: store_id=${savedStore.store_id}, name=${name}`);

      // 사용자의 store_id 업데이트 및 닉네임 설정
      user.store_id = savedStore.store_id;
      // 닉네임을 "가게 이름 + 공백 + 담당자"로 설정
      if (name && owner) {
        user.nickname = `${name} ${owner}`;
        console.log(`✅ [상점 등록] 사용자 닉네임 설정: ${user.nickname}`);
      }

      // 비즈니스 계정은 기본적으로 PENDING 상태로 설정
      if ((user as any).status !== undefined) {
        (user as any).status = 'PENDING';
        console.log(`✅ [상점 등록] 사용자 상태를 PENDING으로 설정`);
      }

      await userRepository.save(user);

      return res.status(201).json({
        success: true,
        message: '상점이 등록되었습니다.',
        data: {
          store_id: savedStore.store_id,
          name: savedStore.name,
        },
      });
    } catch (error) {
      console.error('❌ [상점 등록] 오류 발생:', error);
      console.error('❌ [상점 등록] 오류 상세:', (error as Error).message);
      console.error('❌ [상점 등록] 오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '상점 등록 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 내 상점 조회
   * GET /api/stores/me
   */
  static async getMyStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      // location 필드에서 좌표 추출 (PostGIS Point: [longitude, latitude])
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (store.location && store.location.coordinates) {
        // PostGIS Point는 [longitude, latitude] 순서
        longitude = store.location.coordinates[0] ?? null;
        latitude = store.location.coordinates[1] ?? null;
      }

      return res.json({
        success: true,
        data: {
          store_id: store.store_id,
          name: store.name,
          biz_reg_no: store.biz_reg_no,
          owner: store.owner,
          address: store.address,
          phone_number: store.phone_number,
          description: store.description,
          operating_hours: store.operating_hours,
          off_days: store.off_days,
          profile_image_url: store.profile_image_url,
          visit_count: store.visit_count,
          created_at: store.created_at,
          latitude,
          longitude,
        },
      });
    } catch (error) {
      console.error('내 상점 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 가게 상세 조회 (store_id로)
   * GET /api/stores/:store_id
   * 인증 불필요 (공개 정보)
   */
  static async getStoreDetail(req: Request, res: Response) {
    try {
      const {store_id} = req.params;
      if (!store_id) {
        return res.status(400).json({
          success: false,
          message: '가게 ID가 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {store_id},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '가게를 찾을 수 없습니다.',
        });
      }

      // location 필드에서 좌표 추출
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (store.location && store.location.coordinates) {
        longitude = store.location.coordinates[0] ?? null;
        latitude = store.location.coordinates[1] ?? null;
      }

      return res.json({
        success: true,
        data: {
          store_id: store.store_id,
          name: store.name,
          biz_reg_no: store.biz_reg_no,
          owner: store.owner,
          address: store.address,
          phone_number: store.phone_number,
          description: store.description,
          operating_hours: store.operating_hours,
          off_days: store.off_days,
          profile_image_url: store.profile_image_url,
          visit_count: store.visit_count,
          created_at: store.created_at,
          latitude,
          longitude,
        },
      });
    } catch (error) {
      console.error('가게 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 가게 방문 수 증가
   * POST /api/stores/:store_id/visit
   * 인증 불필요
   */
  static async incrementStoreVisitCount(req: Request, res: Response) {
    try {
      const {store_id} = req.params;
      if (!store_id) {
        return res.status(400).json({
          success: false,
          message: '가게 ID가 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {store_id},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '가게를 찾을 수 없습니다.',
        });
      }

      store.visit_count = (store.visit_count || 0) + 1;
      await storeRepository.save(store);

      return res.json({
        success: true,
        data: {
          store_id: store.store_id,
          visit_count: store.visit_count,
        },
      });
    } catch (error) {
      console.error('가게 방문 수 증가 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 상점 정보 수정
   * PUT /api/stores/me
   */
  static async updateStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {
        name,
        biz_reg_no,
        owner,
        address,
        detailed_address,
        phone_number,
        description,
        operating_hours,
        off_days,
        latitude,
        longitude,
        profile_image_url,
      } = req.body;

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      // 주소 합치기 (상세 주소가 있으면 추가)
      const fullAddress = detailed_address ? `${address} ${detailed_address}` : address;

      // 위치 정보 생성
      let locationData: {type: 'Point'; coordinates: [number, number]} | undefined = undefined;
      if (latitude && longitude) {
        locationData = {
          type: 'Point',
          coordinates: [Number(longitude), Number(latitude)],
        };
      }

      // 상점 정보 업데이트
      if (name) store.name = name;
      if (biz_reg_no) store.biz_reg_no = biz_reg_no;
      if (owner !== undefined) store.owner = owner || null;
      if (address) store.address = fullAddress;
      if (phone_number !== undefined) store.phone_number = phone_number || null;
      if (description !== undefined) store.description = description || null;
      if (operating_hours !== undefined) store.operating_hours = operating_hours || null;
      if (off_days !== undefined) store.off_days = off_days || null;
      if (profile_image_url !== undefined) {
        // S3 URL을 상대 경로로 변환하여 저장
        store.profile_image_url = normalizeToRelativePath(profile_image_url);
      }
      if (locationData) store.location = locationData as any;

      await storeRepository.save(store);

      // 사용자 닉네임 업데이트 (이름과 담당자가 있으면)
      if (name && owner) {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
          where: {user_id: userId},
        });
        if (user) {
          user.nickname = `${name} ${owner}`;
          await userRepository.save(user);
        }
      }

      return res.json({
        success: true,
        message: '상점 정보가 수정되었습니다.',
        data: {
          store_id: store.store_id,
          name: store.name,
          biz_reg_no: store.biz_reg_no,
          owner: store.owner,
          address: store.address,
          phone_number: store.phone_number,
          description: store.description,
          operating_hours: store.operating_hours,
          off_days: store.off_days,
          profile_image_url: store.profile_image_url,
        },
      });
    } catch (error) {
      console.error('상점 정보 수정 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 상점 대시보드 통계 조회
   * GET /api/stores/me/dashboard?days=1|7|30
   */
  static async getStoreDashboardStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const flyerRepository = AppDataSource.getRepository(Flyer);

      // 기획 상품 총 노출 수 (view_count 합계, 기간 내)
      const promotionImpressionsResult = await promotionRepository
        .createQueryBuilder('promotion')
        .select('COALESCE(SUM(promotion.view_count), 0)', 'total')
        .where('promotion.store_id = :storeId', {storeId: store.store_id})
        .andWhere('promotion.delete_yn = false')
        .andWhere('promotion.created_at >= :startDate', {startDate})
        .getRawOne();
      const promotion_impressions = parseInt(promotionImpressionsResult?.total || '0', 10);

      // 가게 페이지 방문 수 (visit_count는 전체 누적이므로, 기간별로는 별도 로그가 필요하지만
      // 현재는 전체 visit_count를 반환. 추후 방문 로그 테이블 추가 시 수정 필요)
      // 일단은 전체 visit_count 반환
      const store_visits = store.visit_count || 0;

      // 전단지 조회 수 (view_count 합계, 기간 내)
      const flyerViewsResult = await flyerRepository
        .createQueryBuilder('flyer')
        .select('COALESCE(SUM(flyer.view_count), 0)', 'total')
        .where('flyer.store_id = :storeId', {storeId: store.store_id})
        .andWhere('flyer.delete_yn = false')
        .andWhere('flyer.created_at >= :startDate', {startDate})
        .getRawOne();
      const flyer_views = parseInt(flyerViewsResult?.total || '0', 10);

      // biz 사용 금액 계산
      // 기획 상품/전단지 조회: 회당 3원
      // 가게 페이지 방문: 회당 2원
      const biz_spent = (promotion_impressions + flyer_views) * 3 + store_visits * 2;

      return res.json({
        success: true,
        data: {
          promotion_impressions,
          store_visits,
          flyer_views,
          biz_spent,
        },
      });
    } catch (error) {
      console.error('상점 대시보드 통계 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 가게 프로모션 목록 조회 (store_id로, 공개 API)
   * GET /api/stores/:store_id/promotions
   * 인증 불필요 (공개 정보)
   */
  static async getStorePromotions(req: Request, res: Response) {
    try {
      const {store_id} = req.params;
      if (!store_id) {
        return res.status(400).json({
          success: false,
          message: '가게 ID가 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {store_id},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '가게를 찾을 수 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const promotions = await promotionRepository.find({
        where: {
          store_id: store.store_id,
          delete_yn: false,
        },
        relations: ['ingredient'],
        order: {created_at: 'DESC'},
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const formattedPromotions = promotions.map(promo => {
        const startDate = new Date(promo.start_date);
        const endDate = new Date(promo.end_date);
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const isActive = start <= today && today <= end;

        return {
          promotion_id: promo.promotion_id,
          ingredient_id: promo.ingredient_id,
          ingredient_name: (promo.ingredient as any)?.name || null,
          title: promo.title,
          description: promo.description,
          sale_price: promo.sale_price,
          original_price: promo.original_price,
          start_date: promo.start_date,
          end_date: promo.end_date,
          promotion_image_url: promo.promotion_image_url,
          quantity: promo.quantity,
          quantity_unit: promo.quantity_unit,
          view_count: promo.view_count,
          created_at: promo.created_at,
          is_active: isActive,
        };
      });

      return res.json({
        success: true,
        data: formattedPromotions,
      });
    } catch (error) {
      console.error('가게 프로모션 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 상점의 진행 중인 프로모션 목록 조회
   * GET /api/stores/me/promotions/active
   */
  static async getMyStoreActivePromotions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      // 진행 중인 프로모션 조회
      const promotionRepository = AppDataSource.getRepository(Promotion);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const promotions = await promotionRepository.find({
        where: {
          store_id: store.store_id,
          delete_yn: false,
        },
        order: {end_date: 'ASC'},
      });

      // 현재 날짜 기준으로 진행 중인 프로모션만 필터링
      const activePromotions = promotions
        .filter(promo => {
          const startDate = new Date(promo.start_date);
          const endDate = new Date(promo.end_date);
          const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          return start <= today && today <= end;
        })
        .map(promo => {
          const endDate = new Date(promo.end_date);
          const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          return {
            promotion_id: promo.promotion_id,
            title: promo.title,
            description: promo.description || '',
            image_url: promo.promotion_image_url || null,
            discount_value: promo.original_price
              ? promo.original_price - promo.sale_price
              : promo.sale_price,
            valid_from: promo.start_date,
            valid_until: promo.end_date,
            days_left: daysLeft > 0 ? daysLeft : 0,
          };
        });

      console.log('📋 [상점 프로모션] 진행 중인 프로모션 조회:', {
        store_id: store.store_id,
        count: activePromotions.length,
      });

      return res.json({
        success: true,
        data: activePromotions,
      });
    } catch (error) {
      console.error('진행 중인 프로모션 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 전단지 등록
   * POST /api/stores/me/flyers
   */
  static async createFlyer(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {title, start_date, end_date, flyer_image_url} = req.body;

      // 필수 정보 검증
      if (!start_date || !end_date || !flyer_image_url) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다. (시작일, 종료일, 전단지 이미지)',
        });
      }

      // 사용자의 상점 확인
      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      // 전단지 생성
      const flyerRepository = AppDataSource.getRepository(Flyer);
      const newFlyer = flyerRepository.create({
        store_id: store.store_id,
        title: title || null,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        flyer_image_url,
      });

      const savedFlyer = await flyerRepository.save(newFlyer);

      return res.status(201).json({
        success: true,
        message: '전단지가 등록되었습니다.',
        data: {
          flyer_id: savedFlyer.flyer_id,
          title: savedFlyer.title,
          start_date: savedFlyer.start_date,
          end_date: savedFlyer.end_date,
          flyer_image_url: savedFlyer.flyer_image_url,
        },
      });
    } catch (error) {
      console.error('전단지 등록 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 상점의 전단지 목록 조회
   * GET /api/stores/me/flyers
   */
  static async getMyFlyers(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyers = await flyerRepository.find({
        where: {
          store_id: store.store_id,
          delete_yn: false,
        },
        order: {created_at: 'DESC'},
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const formattedFlyers = flyers.map(flyer => {
        const startDate = new Date(flyer.start_date);
        const endDate = new Date(flyer.end_date);
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const isActive = start <= today && today <= end;

        return {
          flyer_id: flyer.flyer_id,
          title: flyer.title,
          start_date: flyer.start_date,
          end_date: flyer.end_date,
          flyer_image_url: flyer.flyer_image_url,
          view_count: flyer.view_count,
          created_at: flyer.created_at,
          is_active: isActive,
        };
      });

      return res.json({
        success: true,
        data: formattedFlyers,
      });
    } catch (error) {
      console.error('내 상점 전단지 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 가게 전단지 목록 조회 (store_id로)
   * GET /api/stores/:store_id/flyers
   * 인증 불필요 (공개 정보)
   */
  static async getStoreFlyers(req: Request, res: Response) {
    try {
      const {store_id} = req.params;
      if (!store_id) {
        return res.status(400).json({
          success: false,
          message: '가게 ID가 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {store_id},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '가게를 찾을 수 없습니다.',
        });
      }

      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyers = await flyerRepository.find({
        where: {
          store_id: store.store_id,
          delete_yn: false,
        },
        order: {
          created_at: 'DESC',
        },
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const formattedFlyers = flyers.map(flyer => {
        const startDate = new Date(flyer.start_date);
        const endDate = new Date(flyer.end_date);
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const isActive = start <= today && today <= end;

        return {
          flyer_id: flyer.flyer_id,
          title: flyer.title,
          start_date: flyer.start_date,
          end_date: flyer.end_date,
          flyer_image_url: flyer.flyer_image_url,
          view_count: flyer.view_count,
          created_at: flyer.created_at,
          is_active: isActive,
        };
      });

      return res.json({
        success: true,
        data: formattedFlyers,
      });
    } catch (error) {
      console.error('가게 전단지 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 가게 전단지 상세 조회 (store_id로, 공개 API)
   * GET /api/stores/:store_id/flyers/:flyer_id
   * 인증 불필요 (공개 정보)
   */
  static async getStoreFlyer(req: Request, res: Response) {
    try {
      const {store_id, flyer_id} = req.params;
      if (!store_id || !flyer_id) {
        return res.status(400).json({
          success: false,
          message: '가게 ID와 전단지 ID가 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {store_id},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '가게를 찾을 수 없습니다.',
        });
      }

      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyer = await flyerRepository.findOne({
        where: {
          flyer_id,
          store_id: store.store_id,
          delete_yn: false,
        },
      });

      if (!flyer) {
        return res.status(404).json({
          success: false,
          message: '전단지를 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          flyer_id: flyer.flyer_id,
          title: flyer.title,
          start_date: flyer.start_date,
          end_date: flyer.end_date,
          flyer_image_url: flyer.flyer_image_url,
          view_count: flyer.view_count,
          created_at: flyer.created_at,
        },
      });
    } catch (error) {
      console.error('가게 전단지 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 전단지 상세 조회
   * GET /api/stores/me/flyers/:flyer_id
   */
  static async getFlyer(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {flyer_id} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyer = await flyerRepository.findOne({
        where: {
          flyer_id,
          store_id: store.store_id,
          delete_yn: false,
        },
      });

      if (!flyer) {
        return res.status(404).json({
          success: false,
          message: '전단지를 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          flyer_id: flyer.flyer_id,
          title: flyer.title,
          start_date: flyer.start_date,
          end_date: flyer.end_date,
          flyer_image_url: flyer.flyer_image_url,
          view_count: flyer.view_count,
          created_at: flyer.created_at,
        },
      });
    } catch (error) {
      console.error('전단지 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 전단지 수정
   * PUT /api/stores/me/flyers/:flyer_id
   */
  static async updateFlyer(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {flyer_id} = req.params;
      const {title, start_date, end_date, flyer_image_url} = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyer = await flyerRepository.findOne({
        where: {
          flyer_id,
          store_id: store.store_id,
          delete_yn: false,
        },
      });

      if (!flyer) {
        return res.status(404).json({
          success: false,
          message: '전단지를 찾을 수 없습니다.',
        });
      }

      // 전단지 정보 업데이트
      if (title !== undefined) flyer.title = title || null;
      if (start_date) flyer.start_date = new Date(start_date);
      if (end_date) flyer.end_date = new Date(end_date);
      if (flyer_image_url !== undefined) flyer.flyer_image_url = flyer_image_url || null;

      await flyerRepository.save(flyer);

      return res.json({
        success: true,
        message: '전단지가 수정되었습니다.',
        data: {
          flyer_id: flyer.flyer_id,
          title: flyer.title,
          start_date: flyer.start_date,
          end_date: flyer.end_date,
          flyer_image_url: flyer.flyer_image_url,
        },
      });
    } catch (error) {
      console.error('전단지 수정 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 전단지 삭제
   * DELETE /api/stores/me/flyers/:flyer_id
   */
  static async deleteFlyer(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {flyer_id} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyer = await flyerRepository.findOne({
        where: {
          flyer_id,
          store_id: store.store_id,
          delete_yn: false,
        },
      });

      if (!flyer) {
        return res.status(404).json({
          success: false,
          message: '전단지를 찾을 수 없습니다.',
        });
      }

      // Soft delete
      flyer.delete_yn = true;
      flyer.deleted_at = new Date();
      await flyerRepository.save(flyer);

      return res.json({
        success: true,
        message: '전단지가 삭제되었습니다.',
      });
    } catch (error) {
      console.error('전단지 삭제 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 재료 목록 조회 (프로모션 등록용)
   * GET /api/stores/ingredients
   */
  static async getIngredients(req: Request, res: Response) {
    try {
      const {search} = req.query;
      const ingredientRepository = AppDataSource.getRepository(Ingredient);
      
      let query = ingredientRepository.createQueryBuilder('ingredient');
      
      if (search && typeof search === 'string') {
        query = query.where('ingredient.name ILIKE :search', {
          search: `%${search}%`,
        });
      }
      
      const ingredients = await query
        .orderBy('ingredient.name', 'ASC')
        .limit(100)
        .getMany();

      return res.json({
        success: true,
        data: ingredients.map(ing => ({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          default_unit: ing.default_unit || null,
        })),
      });
    } catch (error) {
      console.error('재료 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 기획 상품 등록
   * POST /api/stores/me/promotions
   */
  static async createPromotion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {
        ingredient_id,
        title,
        description,
        sale_price,
        original_price,
        start_date,
        end_date,
        promotion_image_url,
        quantity,
        quantity_unit,
      } = req.body;

      // 필수 정보 검증
      if (!ingredient_id || !title || !sale_price || !start_date || !end_date || !promotion_image_url) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다. (재료, 제목, 할인가, 시작일, 종료일, 이미지)',
        });
      }

      // 사용자의 상점 확인
      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      // 프로모션 생성
      const promotionRepository = AppDataSource.getRepository(Promotion);
      const newPromotion = promotionRepository.create({
        store_id: store.store_id,
        ingredient_id: Number(ingredient_id),
        title,
        description: description || null,
        sale_price: Number(sale_price),
        original_price: original_price ? Number(original_price) : undefined,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        promotion_image_url,
        quantity: quantity ? Number(quantity) : undefined,
        quantity_unit: quantity_unit || undefined,
      });

      const savedPromotion = await promotionRepository.save(newPromotion);

      return res.status(201).json({
        success: true,
        message: '기획 상품이 등록되었습니다.',
        data: {
          promotion_id: savedPromotion.promotion_id,
          ingredient_id: savedPromotion.ingredient_id,
          title: savedPromotion.title,
          description: savedPromotion.description,
          sale_price: savedPromotion.sale_price,
          original_price: savedPromotion.original_price,
          start_date: savedPromotion.start_date,
          end_date: savedPromotion.end_date,
          promotion_image_url: savedPromotion.promotion_image_url,
          quantity: savedPromotion.quantity,
          quantity_unit: savedPromotion.quantity_unit,
        },
      });
    } catch (error) {
      console.error('기획 상품 등록 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 내 상점의 프로모션 목록 조회
   * GET /api/stores/me/promotions
   */
  static async getMyPromotions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const promotions = await promotionRepository.find({
        where: {
          store_id: store.store_id,
          delete_yn: false,
        },
        relations: ['ingredient'],
        order: {created_at: 'DESC'},
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const formattedPromotions = promotions.map(promo => {
        const startDate = new Date(promo.start_date);
        const endDate = new Date(promo.end_date);
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const isActive = start <= today && today <= end;

        return {
          promotion_id: promo.promotion_id,
          ingredient_id: promo.ingredient_id,
          ingredient_name: (promo.ingredient as any)?.name || null,
          title: promo.title,
          description: promo.description,
          sale_price: promo.sale_price,
          original_price: promo.original_price,
          start_date: promo.start_date,
          end_date: promo.end_date,
          promotion_image_url: promo.promotion_image_url,
          quantity: promo.quantity,
          quantity_unit: promo.quantity_unit,
          view_count: promo.view_count,
          created_at: promo.created_at,
          is_active: isActive,
        };
      });

      return res.json({
        success: true,
        data: formattedPromotions,
      });
    } catch (error) {
      console.error('내 상점 프로모션 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 프로모션 상세 조회
   * GET /api/stores/me/promotions/:promotion_id
   */
  static async getPromotion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {promotion_id} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const promotion = await promotionRepository.findOne({
        where: {
          promotion_id,
          store_id: store.store_id,
          delete_yn: false,
        },
        relations: ['ingredient'],
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: '프로모션을 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          promotion_id: promotion.promotion_id,
          ingredient_id: promotion.ingredient_id,
          ingredient_name: (promotion.ingredient as any)?.name || null,
          title: promotion.title,
          description: promotion.description,
          sale_price: promotion.sale_price,
          original_price: promotion.original_price,
          start_date: promotion.start_date,
          end_date: promotion.end_date,
          promotion_image_url: promotion.promotion_image_url,
          quantity: promotion.quantity,
          quantity_unit: promotion.quantity_unit,
          view_count: promotion.view_count,
          created_at: promotion.created_at,
        },
      });
    } catch (error) {
      console.error('프로모션 상세 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 프로모션 수정
   * PUT /api/stores/me/promotions/:promotion_id
   */
  static async updatePromotion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {promotion_id} = req.params;
      const {
        ingredient_id,
        title,
        description,
        sale_price,
        original_price,
        start_date,
        end_date,
        promotion_image_url,
        quantity,
        quantity_unit,
      } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const promotion = await promotionRepository.findOne({
        where: {
          promotion_id,
          store_id: store.store_id,
          delete_yn: false,
        },
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: '프로모션을 찾을 수 없습니다.',
        });
      }

      // 프로모션 정보 업데이트
      if (ingredient_id !== undefined) promotion.ingredient_id = Number(ingredient_id);
      if (title !== undefined) promotion.title = title;
      if (description !== undefined) promotion.description = description || null;
      if (sale_price !== undefined) promotion.sale_price = Number(sale_price);
      if (original_price !== undefined) promotion.original_price = original_price ? Number(original_price) : undefined;
      if (start_date) promotion.start_date = new Date(start_date);
      if (end_date) promotion.end_date = new Date(end_date);
      if (promotion_image_url !== undefined) promotion.promotion_image_url = promotion_image_url || null;
      if (quantity !== undefined) promotion.quantity = quantity ? Number(quantity) : undefined;
      if (quantity_unit !== undefined) promotion.quantity_unit = quantity_unit || undefined;

      await promotionRepository.save(promotion);

      return res.json({
        success: true,
        message: '프로모션이 수정되었습니다.',
        data: {
          promotion_id: promotion.promotion_id,
          ingredient_id: promotion.ingredient_id,
          title: promotion.title,
          description: promotion.description,
          sale_price: promotion.sale_price,
          original_price: promotion.original_price,
          start_date: promotion.start_date,
          end_date: promotion.end_date,
          promotion_image_url: promotion.promotion_image_url,
          quantity: promotion.quantity,
          quantity_unit: promotion.quantity_unit,
        },
      });
    } catch (error) {
      console.error('프로모션 수정 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 주소에서 "구" 추출 함수
   * 예: "서울특별시 강남구 역삼동" -> "강남구"
   * 예: "경기도 수원시 영통구" -> "영통구"
   */
  private static extractDistrict(address: string | null | undefined): string | null {
    if (!address) {
      return null;
    }

    // "구"로 끝나는 단어를 찾음
    const districtMatch = address.match(/(\S+구)/);
    if (districtMatch) {
      return districtMatch[1] ?? null;
    }

    return null;
  }

  /**
   * 위치 기반 기획 상품 조회 (SearchScreen용)
   * GET /api/stores/promotions/nearby
   * - 기간이 아직 안 끝난 기획 행사
   * - 유저와 가까운 가게 (같은 "구")
   * - view_count가 낮은 순서로 정렬
   */
  static async getNearbyPromotions(req: Request, res: Response) {
    try {
      const {location_text} = req.query;

      if (!location_text || typeof location_text !== 'string') {
        return res.status(400).json({
          success: false,
          message: '유저의 위치 정보(location_text)가 필요합니다.',
        });
      }

      // 유저의 "구" 추출
      const userDistrict = StoreController.extractDistrict(location_text);
      if (!userDistrict) {
        return res.status(400).json({
          success: false,
          message: '유저의 위치 정보에서 "구"를 찾을 수 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // 기간이 아직 안 끝난 기획 행사 조회
      // view_count가 낮은 순서로 정렬
      // 같은 "구"에 있는 가게만
      const queryBuilder = promotionRepository
        .createQueryBuilder('promotion')
        .leftJoinAndSelect('promotion.store', 'store')
        .leftJoinAndSelect('promotion.ingredient', 'ingredient')
        .where('promotion.delete_yn = :deleteYn', {deleteYn: false})
        .andWhere('promotion.start_date <= :today', {today})
        .andWhere('promotion.end_date >= :today', {today})
        .andWhere('store.address IS NOT NULL')
        .orderBy('promotion.view_count', 'ASC')
        .addOrderBy('promotion.created_at', 'DESC')
        .limit(10); // 여러 개를 가져와서 필터링

      const promotions = await queryBuilder.getMany();

      // 같은 "구"에 있는 기획 상품만 필터링
      const nearbyPromotions = promotions.filter(promo => {
        const store = promo.store as any;
        if (!store?.address) {
          return false;
        }

        const storeDistrict = StoreController.extractDistrict(store.address);
        return storeDistrict === userDistrict;
      });

      // view_count가 낮은 순서로 정렬 (이미 정렬되어 있지만, 필터링 후 다시 정렬)
      nearbyPromotions.sort((a, b) => {
        if (a.view_count !== b.view_count) {
          return a.view_count - b.view_count;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // 첫 번째 기획 상품만 반환
      const topPromotion = nearbyPromotions[0] || null;

      if (!topPromotion) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const store = topPromotion.store as any;
      const ingredient = topPromotion.ingredient as any;

      return res.json({
        success: true,
        data: [
          {
            promotion_id: topPromotion.promotion_id,
            store_id: topPromotion.store_id,
            store_name: store?.name || null,
            store_address: store?.address || null,
            ingredient_id: topPromotion.ingredient_id,
            ingredient_name: ingredient?.name || null,
            title: topPromotion.title,
            description: topPromotion.description,
            sale_price: topPromotion.sale_price,
            original_price: topPromotion.original_price,
            start_date: topPromotion.start_date,
            end_date: topPromotion.end_date,
            promotion_image_url: topPromotion.promotion_image_url,
            quantity: topPromotion.quantity,
            quantity_unit: topPromotion.quantity_unit,
            view_count: topPromotion.view_count,
            created_at: topPromotion.created_at,
          },
        ],
      });
    } catch (error) {
      console.error('근처 기획 상품 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 기획 상품 view_count 증가
   * POST /api/stores/promotions/:promotion_id/view
   * 일일 1회 제한 적용 (사용자 ID가 있는 경우)
   */
  static async incrementPromotionViewCount(req: Request, res: Response) {
    try {
      const {promotion_id} = req.params;
      const userId = (req as any).user?.user_id || req.body.user_id || null;

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const promotion = await promotionRepository.findOne({
        where: {
          promotion_id,
          delete_yn: false,
        },
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: '프로모션을 찾을 수 없습니다.',
        });
      }

      // 사용자 ID가 있는 경우 일일 1회 제한 확인
      if (userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const promotionViewRepository = AppDataSource.getRepository(PromotionView);
        const existingView = await promotionViewRepository.findOne({
          where: {
            promotion_id,
            user_id: userId,
            timestamp: MoreThanOrEqual(today),
          },
        });

        if (existingView) {
          // 이미 오늘 본 기획 상품이면 view_count 증가하지 않음
          return res.json({
            success: true,
            data: {
              promotion_id: promotion.promotion_id,
              view_count: promotion.view_count,
              message: '이미 오늘 본 기획 상품입니다.',
            },
          });
        }

        // 노출 기록 생성
        const promotionView = promotionViewRepository.create({
          promotion_id,
          user_id: userId,
        });
        await promotionViewRepository.save(promotionView);
      }

      // view_count 증가
      promotion.view_count = (promotion.view_count || 0) + 1;
      await promotionRepository.save(promotion);

      return res.json({
        success: true,
        data: {
          promotion_id: promotion.promotion_id,
          view_count: promotion.view_count,
        },
      });
    } catch (error) {
      console.error('기획 상품 view_count 증가 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 전단지 view_count 증가
   * POST /api/stores/flyers/:flyer_id/view
   * 인증 불필요
   */
  static async incrementFlyerViewCount(req: Request, res: Response) {
    try {
      const {flyer_id} = req.params;
      const flyerRepository = AppDataSource.getRepository(Flyer);
      const flyer = await flyerRepository.findOne({
        where: {
          flyer_id,
          delete_yn: false,
        },
      });
      if (!flyer) {
        return res.status(404).json({
          success: false,
          message: '전단지를 찾을 수 없습니다.',
        });
      }
      flyer.view_count = (flyer.view_count || 0) + 1;
      await flyerRepository.save(flyer);
      return res.json({
        success: true,
        data: {
          flyer_id: flyer.flyer_id,
          view_count: flyer.view_count,
        },
      });
    } catch (error) {
      console.error('전단지 view_count 증가 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 프로모션 삭제
   * DELETE /api/stores/me/promotions/:promotion_id
   */
  static async deletePromotion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      const {promotion_id} = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const storeRepository = AppDataSource.getRepository(Store);
      const store = await storeRepository.findOne({
        where: {user_id: userId},
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: '등록된 상점이 없습니다.',
        });
      }

      const promotionRepository = AppDataSource.getRepository(Promotion);
      const promotion = await promotionRepository.findOne({
        where: {
          promotion_id,
          store_id: store.store_id,
          delete_yn: false,
        },
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: '프로모션을 찾을 수 없습니다.',
        });
      }

      // Soft delete
      promotion.delete_yn = true;
      promotion.deleted_at = new Date();
      await promotionRepository.save(promotion);

      return res.json({
        success: true,
        message: '프로모션이 삭제되었습니다.',
      });
    } catch (error) {
      console.error('프로모션 삭제 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }
}

