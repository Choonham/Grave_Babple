import {Request, Response} from 'express';
import {In, MoreThanOrEqual} from 'typeorm';
import {AppDataSource} from '../config/database';
import {Advertiser} from '../models/Store';
import {User} from '../models/User';
import {normalizeToRelativePath} from '../utils/imageUrl';
import {getKSTDate, toKSTDate} from '../utils/dateHelper';

/**
 * 광고주 컨트롤러
 * 광고주 등록, 조회 등의 기능을 담당
 */
export class AdvertiserController {
  /**
   * 광고주 등록
   * POST /api/advertisers
   * 회원가입 중인 사용자도 등록할 수 있도록 user_id를 body에서도 받을 수 있음
   */
  static async createAdvertiser(req: Request, res: Response) {
    try {
      console.log('📝 [광고주 등록] 컨트롤러 요청 받음');
      console.log('📝 [광고주 등록] 요청 Body:', JSON.stringify(req.body, null, 2));

      // JWT에서 user_id 추출 (인증 미들웨어에서 설정됨) 또는 body에서 직접 받기
      const userId = (req as any).user?.user_id || req.body.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '사용자 ID가 필요합니다.',
        });
      }

      const {
        biz_name,
        biz_owner,
        biz_reg_no,
        biz_address,
      } = req.body;

      // 필수 정보 검증
      if (!biz_name || !biz_reg_no) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다. (사업자명, 사업자등록번호)',
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

      // 사용자 role 확인 (광고주는 role=2)
      if (user.role !== 2) {
        return res.status(403).json({
          success: false,
          message: '광고주 계정만 등록할 수 있습니다.',
        });
      }

      // 사업자 등록번호 중복 확인
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const existingAdvertiser = await advertiserRepository.findOne({
        where: {biz_reg_no, user_id: userId},
      });

      if (existingAdvertiser) {
        return res.status(409).json({
          success: false,
          message: '이미 등록된 사업자 등록번호입니다.',
        });
      }

      // 광고주 생성
      const newAdvertiser = advertiserRepository.create({
        user_id: userId,
        biz_name,
        biz_owner: biz_owner || null,
        biz_reg_no,
        biz_address: biz_address || null,
        charged: 0,
      });

      const savedAdvertiser = await advertiserRepository.save(newAdvertiser);
      console.log(`✅ [광고주 등록] 광고주 생성 완료: advertiser_id=${savedAdvertiser.advertiser_id}, biz_name=${biz_name}`);

      // 사용자 닉네임 설정 (사업자명 + 소유주명)
      if (biz_name && biz_owner) {
        user.nickname = `${biz_name} ${biz_owner}`;
        console.log(`✅ [광고주 등록] 사용자 닉네임 설정: ${user.nickname}`);
      } else if (biz_name) {
        user.nickname = biz_name;
        console.log(`✅ [광고주 등록] 사용자 닉네임 설정: ${user.nickname}`);
      }

      // 비즈니스 계정은 기본적으로 PENDING 상태로 설정
      if ((user as any).status !== undefined) {
        (user as any).status = 'PENDING';
        console.log(`✅ [광고주 등록] 사용자 상태를 PENDING으로 설정`);
      }

      await userRepository.save(user);

      return res.status(201).json({
        success: true,
        message: '광고주가 등록되었습니다.',
        data: {
          advertiser_id: savedAdvertiser.advertiser_id,
          biz_name: savedAdvertiser.biz_name,
        },
      });
    } catch (error) {
      console.error('❌ [광고주 등록] 오류 발생:', error);
      console.error('❌ [광고주 등록] 오류 상세:', (error as Error).message);
      console.error('❌ [광고주 등록] 오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '광고주 등록 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 내 광고주 정보 조회
   * GET /api/advertisers/me
   */
  static async getMyAdvertiser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          advertiser_id: advertiser.advertiser_id,
          biz_name: advertiser.biz_name,
          biz_owner: advertiser.biz_owner,
          biz_reg_no: advertiser.biz_reg_no,
          biz_address: advertiser.biz_address,
          charged: advertiser.charged,
          created_at: advertiser.created_at,
        },
      });
    } catch (error) {
      console.error('❌ [광고주 정보 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '광고주 정보 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 내 광고 소재 목록 조회
   * GET /api/advertisers/me/creatives
   */
  static async getMyCreatives(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 광고 소재 목록 조회
      const {AdCreative} = await import('../models/Store');
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creatives = await creativeRepository.find({
        where: {
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
        order: {
          created_at: 'DESC',
        },
      });

      return res.json({
        success: true,
        data: creatives.map(creative => ({
          creative_id: creative.creative_id,
          ad_title: creative.ad_title,
          ad_body: creative.ad_body,
          ad_image_url: creative.ad_image_url,
          ad_type: creative.ad_type,
          landing_page_url: creative.landing_page_url,
          creater_name: creative.creater_name,
          creater_image_url: creative.creater_image_url,
          campaign_id: creative.campaign_id,
          created_at: creative.created_at,
        })),
      });
    } catch (error) {
      console.error('❌ [광고 소재 목록 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '광고 소재 목록 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고 소재 등록
   * POST /api/advertisers/me/creatives
   */
  static async createCreative(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      const {
        ad_title,
        ad_body,
        ad_image_url,
        ad_type, // 1: 피드광고, 2: 레시피카드 광고
        landing_page_url,
        creater_name,
        creater_image_url,
      } = req.body;

      // 필수 정보 검증
      if (!ad_image_url || !landing_page_url) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다. (이미지, 연결 페이지 주소)',
        });
      }

      // ad_type 검증 (1: 피드광고, 2: 레시피카드 광고)
      if (ad_type !== 1 && ad_type !== 2) {
        return res.status(400).json({
          success: false,
          message: '올바른 광고 유형을 선택해주세요. (1: 피드광고, 2: 레시피카드 광고)',
        });
      }

      // 피드 광고(ad_type === 1)일 때 creater_image_url이 없으면 광고주의 프로필 이미지를 자동으로 설정
      let finalCreaterImageUrl = creater_image_url || null;

      if (ad_type === 1 && !finalCreaterImageUrl) {
        // 광고주의 User 정보 조회
        const {User} = await import('../models/User');
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
          where: {user_id: advertiser.user_id},
          select: ['profile_image_url'],
        });

        if (user?.profile_image_url) {
          finalCreaterImageUrl = user.profile_image_url;
          console.log(`✅ [광고 소재 등록] 피드 광고에 광고주 프로필 이미지 자동 설정: ${finalCreaterImageUrl}`);
        }
      }

      // 광고 소재 생성 (campaign_id는 null로 시작)
      const {AdCreative} = await import('../models/Store');
      const creativeRepository = AppDataSource.getRepository(AdCreative);

      const newCreative = creativeRepository.create({
        advertiser_id: advertiser.advertiser_id,
        campaign_id: null,
        ad_title: ad_title || null,
        ad_body: ad_body || null,
        ad_image_url: normalizeToRelativePath(ad_image_url) || '',
        ad_type,
        landing_page_url,
        creater_name: creater_name || null,
        creater_image_url: normalizeToRelativePath(finalCreaterImageUrl),
      } as any);

      const savedCreative = (await creativeRepository.save(newCreative)) as any;
      console.log(`✅ [광고 소재 등록] 광고 소재 생성 완료: creative_id=${savedCreative.creative_id}`);

      return res.status(201).json({
        success: true,
        message: '광고 소재가 등록되었습니다.',
        data: {
          creative_id: savedCreative.creative_id,
          ad_title: savedCreative.ad_title,
          ad_type: savedCreative.ad_type,
        },
      });
    } catch (error) {
      console.error('❌ [광고 소재 등록] 오류 발생:', error);
      console.error('❌ [광고 소재 등록] 오류 상세:', (error as Error).message);
      console.error('❌ [광고 소재 등록] 오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '광고 소재 등록 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고 소재 상세 조회
   * GET /api/advertisers/me/creatives/:creative_id
   */
  static async getCreative(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {creative_id} = req.params;

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 광고 소재 조회
      const {AdCreative} = await import('../models/Store');
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creative = await creativeRepository.findOne({
        where: {
          creative_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!creative) {
        return res.status(404).json({
          success: false,
          message: '광고 소재를 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          creative_id: creative.creative_id,
          ad_title: creative.ad_title,
          ad_body: creative.ad_body,
          ad_image_url: creative.ad_image_url,
          ad_type: creative.ad_type,
          landing_page_url: creative.landing_page_url,
          creater_name: creative.creater_name,
          creater_image_url: creative.creater_image_url,
          created_at: creative.created_at,
          updated_at: creative.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ [광고 소재 상세 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '광고 소재 상세 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고 소재 수정
   * PUT /api/advertisers/me/creatives/:creative_id
   */
  static async updateCreative(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {creative_id} = req.params;

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 광고 소재 조회
      const {AdCreative} = await import('../models/Store');
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creative = await creativeRepository.findOne({
        where: {
          creative_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!creative) {
        return res.status(404).json({
          success: false,
          message: '광고 소재를 찾을 수 없습니다.',
        });
      }

      const {
        ad_title,
        ad_body,
        ad_image_url,
        ad_type,
        landing_page_url,
        creater_name,
        creater_image_url,
      } = req.body;

      // 필수 정보 검증
      if (ad_image_url !== undefined && !ad_image_url) {
        return res.status(400).json({
          success: false,
          message: '이미지 URL은 필수입니다.',
        });
      }

      if (landing_page_url !== undefined && !landing_page_url) {
        return res.status(400).json({
          success: false,
          message: '연결 페이지 주소는 필수입니다.',
        });
      }

      // ad_type 검증 (1: 피드광고, 2: 레시피카드 광고)
      if (ad_type !== undefined && ad_type !== 1 && ad_type !== 2) {
        return res.status(400).json({
          success: false,
          message: '올바른 광고 유형을 선택해주세요. (1: 피드광고, 2: 레시피카드 광고)',
        });
      }

      // 광고 소재 업데이트
      if (ad_title !== undefined) creative.ad_title = ad_title || null;
      if (ad_body !== undefined) creative.ad_body = ad_body || null;
      if (ad_image_url !== undefined) {
        creative.ad_image_url = normalizeToRelativePath(ad_image_url) || '';
      }
      if (ad_type !== undefined) creative.ad_type = ad_type;
      if (landing_page_url !== undefined) creative.landing_page_url = landing_page_url;
      if (creater_name !== undefined) creative.creater_name = creater_name || null;
      if (creater_image_url !== undefined) {
        creative.creater_image_url = normalizeToRelativePath(creater_image_url);
      }

      const updatedCreative = await creativeRepository.save(creative);
      console.log(`✅ [광고 소재 수정] 광고 소재 수정 완료: creative_id=${updatedCreative.creative_id}`);

      return res.json({
        success: true,
        message: '광고 소재가 수정되었습니다.',
        data: {
          creative_id: updatedCreative.creative_id,
          ad_title: updatedCreative.ad_title,
          ad_type: updatedCreative.ad_type,
        },
      });
    } catch (error) {
      console.error('❌ [광고 소재 수정] 오류 발생:', error);
      console.error('❌ [광고 소재 수정] 오류 상세:', (error as Error).message);
      return res.status(500).json({
        success: false,
        message: '광고 소재 수정 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고 소재 삭제
   * DELETE /api/advertisers/me/creatives/:creative_id
   */
  static async deleteCreative(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {creative_id} = req.params;

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 광고 소재 조회
      const {AdCreative} = await import('../models/Store');
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creative = await creativeRepository.findOne({
        where: {
          creative_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!creative) {
        return res.status(404).json({
          success: false,
          message: '광고 소재를 찾을 수 없습니다.',
        });
      }

      // 소프트 삭제
      creative.delete_yn = true;
      creative.deleted_at = new Date();
      await creativeRepository.save(creative);

      console.log(`✅ [광고 소재 삭제] 광고 소재 삭제 완료: creative_id=${creative_id}`);

      return res.json({
        success: true,
        message: '광고 소재가 삭제되었습니다.',
      });
    } catch (error) {
      console.error('❌ [광고 소재 삭제] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '광고 소재 삭제 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 캠페인 생성
   * POST /api/advertisers/me/campaigns
   */
  static async createCampaign(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      const {
        campaign_name,
        total_budget,
        cpi,
        start_date,
        end_date,
        creative_ids, // 선택한 광고 소재 ID 배열
      } = req.body;

      // 필수 정보 검증
      if (!campaign_name || !total_budget || !cpi || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: '필수 정보가 누락되었습니다.',
        });
      }

      if (!creative_ids || !Array.isArray(creative_ids) || creative_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '최소 1개 이상의 광고 소재를 선택해주세요.',
        });
      }

      // 날짜 검증
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: '올바른 날짜 형식이 아닙니다.',
        });
      }

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: '종료일은 시작일보다 늦어야 합니다.',
        });
      }

      // CPI가 총 예산보다 큰지 검증
      const cpiValue = Number(cpi);
      const totalBudgetValue = Number(total_budget);

      if (cpiValue > totalBudgetValue) {
        return res.status(400).json({
          success: false,
          message: '노출당 단가(CPI)는 총 소진 예산보다 클 수 없습니다.',
        });
      }

      // 선택한 광고 소재들이 존재하고, campaign_id가 null인지 확인
      const {AdCreative} = await import('../models/Store');
      const creativeRepository = AppDataSource.getRepository(AdCreative);

      const creatives = await creativeRepository.find({
        where: {
          creative_id: In(creative_ids),
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (creatives.length !== creative_ids.length) {
        return res.status(400).json({
          success: false,
          message: '일부 광고 소재를 찾을 수 없습니다.',
        });
      }

      // 이미 campaign_id가 있는 소재가 있는지 확인
      const alreadyAssigned = creatives.filter(c => c.campaign_id !== null);
      if (alreadyAssigned.length > 0) {
        return res.status(400).json({
          success: false,
          message: '이미 다른 캠페인에 할당된 광고 소재가 포함되어 있습니다.',
        });
      }

      // 캠페인 생성
      const {AdCampaign} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);

      const newCampaign = campaignRepository.create({
        advertiser_id: advertiser.advertiser_id,
        campaign_name,
        total_budget: Number(total_budget),
        cpi: Number(cpi),
        start_date: startDate,
        end_date: endDate,
        status: 'PENDING',
      });

      const savedCampaign = await campaignRepository.save(newCampaign);
      console.log(`✅ [캠페인 생성] 캠페인 생성 완료: campaign_id=${savedCampaign.campaign_id}`);

      // 선택한 광고 소재들의 campaign_id 업데이트
      await creativeRepository.update(
        {creative_id: In(creative_ids)},
        {campaign_id: savedCampaign.campaign_id},
      );

      console.log(`✅ [캠페인 생성] ${creative_ids.length}개의 광고 소재를 캠페인에 연결`);

      return res.status(201).json({
        success: true,
        message: '캠페인이 생성되었습니다.',
        data: {
          campaign_id: savedCampaign.campaign_id,
          campaign_name: savedCampaign.campaign_name,
        },
      });
    } catch (error) {
      console.error('❌ [캠페인 생성] 오류 발생:', error);
      console.error('❌ [캠페인 생성] 오류 상세:', (error as Error).message);
      console.error('❌ [캠페인 생성] 오류 스택:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        message: '캠페인 생성 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 내 캠페인 목록 조회
   * GET /api/advertisers/me/campaigns
   */
  static async getMyCampaigns(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 캠페인 목록 조회
      const {AdCampaign} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaigns = await campaignRepository.find({
        where: {
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
        order: {
          created_at: 'DESC',
        },
      });

      // 현재 날짜 기준으로 상태 계산 및 추가 정보 계산 (KST 기준)
      const now = getKSTDate();

      const formattedCampaigns = campaigns.map(campaign => {
        const startDate = toKSTDate(new Date(campaign.start_date));
        const endDate = toKSTDate(new Date(campaign.end_date));

        // 상태 결정 (DB의 status가 PENDING이면 그대로, 아니면 날짜 기준으로 계산)
        let status = campaign.status;
        if (status === 'PENDING') {
          // PENDING 상태는 그대로 유지
        } else if (now < startDate) {
          status = 'PENDING';
        } else if (now >= startDate && now <= endDate) {
          status = 'ACTIVE';
        } else {
          status = 'COMPLETED';
        }

        // 소진 금액 계산 (view_count * cpi)
        const spent = Number(campaign.view_count) * Number(campaign.cpi);

        // 남은 일수 계산 (KST 기준)
        const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // 진행률 계산 (소진 금액 / 총 예산 * 100)
        const progress = campaign.total_budget > 0
          ? Math.min(100, (spent / Number(campaign.total_budget)) * 100)
          : 0;

        return {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          total_budget: Number(campaign.total_budget),
          cpi: Number(campaign.cpi),
          start_date: campaign.start_date,
          end_date: campaign.end_date,
          status,
          view_count: campaign.view_count,
          click_count: campaign.click_count,
          spent,
          daysLeft,
          progress,
          created_at: campaign.created_at,
        };
      });

      return res.json({
        success: true,
        data: formattedCampaigns,
      });
    } catch (error) {
      console.error('❌ [캠페인 목록 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '캠페인 목록 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 캠페인 상세 조회
   * GET /api/advertisers/me/campaigns/:campaign_id
   */
  static async getCampaign(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {campaign_id} = req.params;

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 캠페인 조회
      const {AdCampaign, AdCreative} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {
          campaign_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '캠페인을 찾을 수 없습니다.',
        });
      }

      // 캠페인에 연결된 광고 소재 조회
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creatives = await creativeRepository.find({
        where: {
          campaign_id: campaign.campaign_id,
          delete_yn: false,
        },
        order: {
          created_at: 'DESC',
        },
      });

      // 현재 날짜 기준으로 상태 계산 (KST 기준)
      const now = getKSTDate();
      const startDate = toKSTDate(new Date(campaign.start_date));
      const endDate = toKSTDate(new Date(campaign.end_date));

      let status = campaign.status;
      // PAUSED 상태는 날짜와 관계없이 그대로 유지
      if (status === 'PAUSED') {
        // PAUSED 상태는 그대로 유지
      } else if (status === 'PENDING') {
        // PENDING 상태는 그대로 유지
      } else if (now < startDate) {
        status = 'PENDING';
      } else if (now >= startDate && now <= endDate) {
        status = 'ACTIVE';
      } else {
        status = 'COMPLETED';
      }

      // 소진 금액 계산
      const spent = Number(campaign.view_count) * Number(campaign.cpi);

      // 남은 일수 계산 (KST 기준)
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // 진행률 계산
      const progress = campaign.total_budget > 0
        ? Math.min(100, (spent / Number(campaign.total_budget)) * 100)
        : 0;

      // 평균 CPI 계산
      const avgCPI = campaign.view_count > 0
        ? spent / campaign.view_count
        : 0;

      return res.json({
        success: true,
        data: {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          total_budget: Number(campaign.total_budget),
          cpi: Number(campaign.cpi),
          start_date: campaign.start_date,
          end_date: campaign.end_date,
          status,
          view_count: campaign.view_count,
          click_count: campaign.click_count,
          spent,
          daysLeft,
          progress,
          avgCPI,
          creatives: creatives.map(creative => ({
            creative_id: creative.creative_id,
            ad_title: creative.ad_title,
            ad_body: creative.ad_body,
            ad_image_url: creative.ad_image_url,
            ad_type: creative.ad_type,
            landing_page_url: creative.landing_page_url,
            creater_name: creative.creater_name,
            creater_image_url: creative.creater_image_url,
          })),
          created_at: campaign.created_at,
          updated_at: campaign.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ [캠페인 상세 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '캠페인 상세 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 캠페인 수정
   * PUT /api/advertisers/me/campaigns/:campaign_id
   */
  static async updateCampaign(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {campaign_id} = req.params;

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 캠페인 조회
      const {AdCampaign, AdCreative} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {
          campaign_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '캠페인을 찾을 수 없습니다.',
        });
      }

      const {
        campaign_name,
        total_budget,
        cpi,
        start_date,
        end_date,
        creative_ids, // 선택한 광고 소재 ID 배열 (선택적)
      } = req.body;

      // 날짜 검증
      if (start_date && end_date) {
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: '올바른 날짜 형식이 아닙니다.',
          });
        }

        if (startDate >= endDate) {
          return res.status(400).json({
            success: false,
            message: '종료일은 시작일보다 늦어야 합니다.',
          });
        }
      }

      // CPI가 총 예산보다 큰지 검증 (CPI나 total_budget이 업데이트되는 경우)
      if (cpi !== undefined || total_budget !== undefined) {
        const cpiValue = cpi !== undefined ? Number(cpi) : campaign.cpi;
        const totalBudgetValue = total_budget !== undefined ? Number(total_budget) : campaign.total_budget;

        if (cpiValue > totalBudgetValue) {
          return res.status(400).json({
            success: false,
            message: '노출당 단가(CPI)는 총 소진 예산보다 클 수 없습니다.',
          });
        }
      }

      // 캠페인 정보 업데이트
      if (campaign_name !== undefined) campaign.campaign_name = campaign_name;
      if (total_budget !== undefined) campaign.total_budget = Number(total_budget);
      if (cpi !== undefined) campaign.cpi = Number(cpi);
      if (start_date !== undefined) campaign.start_date = new Date(start_date);
      if (end_date !== undefined) campaign.end_date = new Date(end_date);

      const updatedCampaign = await campaignRepository.save(campaign);

      // 광고 소재 업데이트 (creative_ids가 제공된 경우)
      if (creative_ids && Array.isArray(creative_ids)) {
        const creativeRepository = AppDataSource.getRepository(AdCreative);

        // 기존 캠페인의 모든 소재의 campaign_id를 null로 설정
        await creativeRepository.update(
          {campaign_id: campaign.campaign_id},
          {campaign_id: null as any},
        );

        // 새로 선택한 소재들의 campaign_id 업데이트
        if (creative_ids.length > 0) {
          // 선택한 소재들이 존재하고, 해당 광고주의 소재인지 확인
          const creatives = await creativeRepository.find({
            where: {
              creative_id: In(creative_ids),
              advertiser_id: advertiser.advertiser_id,
              delete_yn: false,
            },
          });

          if (creatives.length !== creative_ids.length) {
            return res.status(400).json({
              success: false,
              message: '일부 광고 소재를 찾을 수 없습니다.',
            });
          }

          // 선택한 소재들의 campaign_id 업데이트
          await creativeRepository.update(
            {creative_id: In(creative_ids)},
            {campaign_id: campaign.campaign_id},
          );
        }
      }

      console.log(`✅ [캠페인 수정] 캠페인 수정 완료: campaign_id=${updatedCampaign.campaign_id}`);

      return res.json({
        success: true,
        message: '캠페인이 수정되었습니다.',
        data: {
          campaign_id: updatedCampaign.campaign_id,
          campaign_name: updatedCampaign.campaign_name,
        },
      });
    } catch (error) {
      console.error('❌ [캠페인 수정] 오류 발생:', error);
      console.error('❌ [캠페인 수정] 오류 상세:', (error as Error).message);
      return res.status(500).json({
        success: false,
        message: '캠페인 수정 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 캠페인 삭제
   * DELETE /api/advertisers/me/campaigns/:campaign_id
   */
  static async deleteCampaign(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {campaign_id} = req.params;

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 캠페인 조회
      const {AdCampaign, AdCreative} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {
          campaign_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '캠페인을 찾을 수 없습니다.',
        });
      }

      // 캠페인에 연결된 광고 소재들의 campaign_id를 null로 설정
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      await creativeRepository.update(
        {campaign_id: campaign.campaign_id},
        {campaign_id: null as any},
      );

      // 소프트 삭제
      campaign.delete_yn = true;
      campaign.deleted_at = new Date();
      await campaignRepository.save(campaign);

      console.log(`✅ [캠페인 삭제] 캠페인 삭제 완료: campaign_id=${campaign_id}`);

      return res.json({
        success: true,
        message: '캠페인이 삭제되었습니다.',
      });
    } catch (error) {
      console.error('❌ [캠페인 삭제] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '캠페인 삭제 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 캠페인 상태 변경 (활성화/비활성화)
   * PUT /api/advertisers/me/campaigns/:campaign_id/status
   */
  static async updateCampaignStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {campaign_id} = req.params;
      const {status} = req.body; // 'ACTIVE' or 'PAUSED'

      if (!status || (status !== 'ACTIVE' && status !== 'PAUSED')) {
        return res.status(400).json({
          success: false,
          message: '올바른 상태 값이 아닙니다. (ACTIVE 또는 PAUSED만 가능)',
        });
      }

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 캠페인 조회
      const {AdCampaign} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {
          campaign_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '캠페인을 찾을 수 없습니다.',
        });
      }

      // PENDING 상태의 캠페인은 활성화할 수 없음
      if (campaign.status === 'PENDING' && status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: '심사 중인 캠페인은 활성화할 수 없습니다.',
        });
      }

      // 상태 업데이트
      campaign.status = status;
      const updatedCampaign = await campaignRepository.save(campaign);

      console.log(`✅ [캠페인 상태 변경] 상태 변경 완료: campaign_id=${campaign_id}, status=${status}`);

      return res.json({
        success: true,
        message: `캠페인이 ${status === 'ACTIVE' ? '활성화' : '비활성화'}되었습니다.`,
        data: {
          campaign_id: updatedCampaign.campaign_id,
          status: updatedCampaign.status,
        },
      });
    } catch (error) {
      console.error('❌ [캠페인 상태 변경] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '캠페인 상태 변경 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고주 대시보드 통계 조회
   * GET /api/advertisers/me/stats?days=7
   */
  static async getAdvertiserStats(req: Request, res: Response) {
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

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      const {AdCampaign, AdCreative, AdImpression, AdClick} = await import('../models/Store');

      // 모든 캠페인 조회 (삭제된 캠페인 포함 - 통계 및 청구를 위해)
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaigns = await campaignRepository.find({
        where: {
          advertiser_id: advertiser.advertiser_id,
          // delete_yn 조건 제거: 삭제된 캠페인도 통계에 포함 (청구를 위해)
        },
      });

      const campaignIds = campaigns.map(c => c.campaign_id);

      // 캠페인별 소재 ID 조회 (삭제된 소재 포함 - 통계 및 청구를 위해)
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creatives = campaignIds.length > 0
        ? await creativeRepository.find({
            where: {
              campaign_id: In(campaignIds),
              // delete_yn 조건 제거: 삭제된 소재도 통계에 포함 (삭제된 캠페인의 소재 포함을 위해)
            },
          })
        : [];

      const creativeIds = creatives.map(c => c.creative_id);

      // 통계 계산
      const impressionRepository = AppDataSource.getRepository(AdImpression);
      const clickRepository = AppDataSource.getRepository(AdClick);

      const totalImpressions = creativeIds.length > 0
        ? await impressionRepository.count({
            where: {
              creative_id: In(creativeIds),
              timestamp: MoreThanOrEqual(startDate),
            },
          })
        : 0;

      const totalClicks = creativeIds.length > 0
        ? await clickRepository.count({
            where: {
              creative_id: In(creativeIds),
              timestamp: MoreThanOrEqual(startDate),
            },
          })
        : 0;

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // 일별 통계 (그래프용)
      const dailyStats: Array<{date: string; impressions: number; clicks: number}> = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayImpressions = creativeIds.length > 0
          ? await impressionRepository
              .createQueryBuilder('impression')
              .where('impression.creative_id IN (:...creativeIds)', {creativeIds})
              .andWhere('impression.timestamp >= :date', {date})
              .andWhere('impression.timestamp < :nextDate', {nextDate})
              .getCount()
          : 0;

        const dayClicks = creativeIds.length > 0
          ? await clickRepository
              .createQueryBuilder('click')
              .where('click.creative_id IN (:...creativeIds)', {creativeIds})
              .andWhere('click.timestamp >= :date', {date})
              .andWhere('click.timestamp < :nextDate', {nextDate})
              .getCount()
          : 0;

        dailyStats.push({
          date: date.toISOString().split('T')[0] as string,
          impressions: dayImpressions,
          clicks: dayClicks,
        });
      }

      return res.json({
        success: true,
        data: {
          totalImpressions,
          totalClicks,
          ctr: Number(ctr.toFixed(2)),
          dailyStats,
        },
      });
    } catch (error) {
      console.error('❌ [광고주 통계 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '통계 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 캠페인 상세 통계 조회
   * GET /api/advertisers/me/campaigns/:campaign_id/stats?days=7
   */
  static async getCampaignStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '인증이 필요합니다.',
        });
      }

      const {campaign_id} = req.params;
      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // 광고주 정보 조회
      const advertiserRepository = AppDataSource.getRepository(Advertiser);
      const advertiser = await advertiserRepository.findOne({
        where: {user_id: userId},
      });

      if (!advertiser) {
        return res.status(404).json({
          success: false,
          message: '등록된 광고주 정보가 없습니다.',
        });
      }

      // 캠페인 조회
      const {AdCampaign, AdCreative, AdImpression, AdClick} = await import('../models/Store');
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const campaign = await campaignRepository.findOne({
        where: {
          campaign_id,
          advertiser_id: advertiser.advertiser_id,
          delete_yn: false,
        },
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: '캠페인을 찾을 수 없습니다.',
        });
      }

      // 캠페인 소재 ID 조회
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creatives = await creativeRepository.find({
        where: {
          campaign_id,
          delete_yn: false,
        },
      });

      const creativeIds = creatives.map(c => c.creative_id);

      // 통계 계산
      const impressionRepository = AppDataSource.getRepository(AdImpression);
      const clickRepository = AppDataSource.getRepository(AdClick);

      const totalImpressions = creativeIds.length > 0
        ? await impressionRepository.count({
            where: {
              creative_id: In(creativeIds),
              timestamp: MoreThanOrEqual(startDate),
            },
          })
        : 0;

      const totalClicks = creativeIds.length > 0
        ? await clickRepository.count({
            where: {
              creative_id: In(creativeIds),
              timestamp: MoreThanOrEqual(startDate),
            },
          })
        : 0;

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // 일별 통계 (그래프용)
      const dailyStats: Array<{date: string; impressions: number; clicks: number}> = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayImpressions = creativeIds.length > 0
          ? await impressionRepository
              .createQueryBuilder('impression')
              .where('impression.creative_id IN (:...creativeIds)', {creativeIds})
              .andWhere('impression.timestamp >= :date', {date})
              .andWhere('impression.timestamp < :nextDate', {nextDate})
              .getCount()
          : 0;

        const dayClicks = creativeIds.length > 0
          ? await clickRepository
              .createQueryBuilder('click')
              .where('click.creative_id IN (:...creativeIds)', {creativeIds})
              .andWhere('click.timestamp >= :date', {date})
              .andWhere('click.timestamp < :nextDate', {nextDate})
              .getCount()
          : 0;

        dailyStats.push({
          date: date.toISOString().split('T')[0] as string,
          impressions: dayImpressions,
          clicks: dayClicks,
        });
      }

      return res.json({
        success: true,
        data: {
          campaign_id,
          campaign_name: campaign.campaign_name,
          totalImpressions,
          totalClicks,
          ctr: Number(ctr.toFixed(2)),
          dailyStats,
        },
      });
    } catch (error) {
      console.error('❌ [캠페인 통계 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '통계 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }
}

