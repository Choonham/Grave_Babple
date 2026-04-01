import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {AdCampaign, AdCreative, AdImpression, AdClick, UserCredit, CreditTransaction} from '../models/Store';
import {RecipePost} from '../models/Post';
import {MoreThanOrEqual} from 'typeorm';
import {getKSTDate, toKSTDate} from '../utils/dateHelper';

/**
 * 광고 컨트롤러
 * 광고 노출 및 클릭 관련 기능
 */
export class AdController {
  /**
   * 광고 소재 조회 (피드 광고용)
   * GET /api/ads/feed
   * 가중치 기반 랜덤 선택 알고리즘 사용
   */
  static async getFeedAd(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id || null;

      // 한국 표준시(KST) 기준 현재 날짜 (UTC+9)
      const now = getKSTDate();

      // ACTIVE 상태이고 기간 내인 캠페인 조회
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const activeCampaigns = await campaignRepository.find({
        where: {
          status: 'ACTIVE',
          delete_yn: false,
        },
      });

      // 기간 내인 캠페인 필터링 (KST 기준)
      const validCampaigns = activeCampaigns.filter(campaign => {
        const startDate = toKSTDate(new Date(campaign.start_date));
        const endDate = toKSTDate(new Date(campaign.end_date));
        return now >= startDate && now <= endDate;
      });

      if (validCampaigns.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // 피드 광고 타입(ad_type = 1)인 소재 조회
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const campaignIds = validCampaigns.map(c => c.campaign_id);
      
      if (campaignIds.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      const feedCreatives = await creativeRepository
        .createQueryBuilder('creative')
        .leftJoinAndSelect('creative.campaign', 'campaign')
        .where('creative.ad_type = :adType', {adType: 1})
        .andWhere('creative.delete_yn = :deleteYn', {deleteYn: false})
        .andWhere('creative.campaign_id IN (:...campaignIds)', {campaignIds})
        .getMany();

      if (feedCreatives.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // 가중치 계산 및 랜덤 선택
      const selectedCreative = AdController.selectCreativeByWeight(feedCreatives, validCampaigns);

      if (!selectedCreative) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // 광고 노출 기록은 프론트엔드에서 별도로 호출하도록 변경
      // impression_id는 null로 반환 (프론트엔드에서 노출 기록 API 호출 시 생성됨)
      let impressionId: string | undefined = undefined;

      return res.json({
        success: true,
        data: {
          creative_id: selectedCreative.creative_id,
          ad_title: selectedCreative.ad_title,
          ad_body: selectedCreative.ad_body,
          ad_image_url: selectedCreative.ad_image_url,
          landing_page_url: selectedCreative.landing_page_url,
          creater_name: selectedCreative.creater_name,
          creater_image_url: selectedCreative.creater_image_url,
          impression_id: impressionId || undefined,
        },
      });
    } catch (error) {
      console.error('❌ [피드 광고 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '피드 광고 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고 소재 조회 (레시피 카드 광고용)
   * GET /api/ads/recipe-card
   * 가중치 기반 랜덤 선택 알고리즘 사용
   */
  static async getRecipeCardAd(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id || null;
      const {recipe_post_id} = req.query;

      // 한국 표준시(KST) 기준 현재 날짜 (UTC+9)
      const now = getKSTDate();

      // ACTIVE 상태이고 기간 내인 캠페인 조회
      const campaignRepository = AppDataSource.getRepository(AdCampaign);
      const activeCampaigns = await campaignRepository.find({
        where: {
          status: 'ACTIVE',
          delete_yn: false,
        },
      });

      // 기간 내인 캠페인 필터링 (KST 기준)
      const validCampaigns = activeCampaigns.filter(campaign => {
        const startDate = toKSTDate(new Date(campaign.start_date));
        const endDate = toKSTDate(new Date(campaign.end_date));
        return now >= startDate && now <= endDate;
      });

      if (validCampaigns.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // 레시피 카드 광고 타입(ad_type = 2)인 소재 조회
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const campaignIds = validCampaigns.map(c => c.campaign_id);
      
      if (campaignIds.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      const recipeCardCreatives = await creativeRepository
        .createQueryBuilder('creative')
        .leftJoinAndSelect('creative.campaign', 'campaign')
        .where('creative.ad_type = :adType', {adType: 2})
        .andWhere('creative.delete_yn = :deleteYn', {deleteYn: false})
        .andWhere('creative.campaign_id IN (:...campaignIds)', {campaignIds})
        .getMany();

      if (recipeCardCreatives.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // 가중치 계산 및 랜덤 선택
      const selectedCreative = AdController.selectCreativeByWeight(recipeCardCreatives, validCampaigns);

      if (!selectedCreative) {
        return res.json({
          success: true,
          data: null,
        });
      }

      // 광고 노출 기록은 프론트엔드에서 별도로 호출하도록 변경
      // impression_id는 null로 반환 (프론트엔드에서 노출 기록 API 호출 시 생성됨)
      let impressionId: string | undefined = undefined;

      return res.json({
        success: true,
        data: {
          creative_id: selectedCreative.creative_id,
          ad_title: selectedCreative.ad_title,
          ad_body: selectedCreative.ad_body,
          ad_image_url: selectedCreative.ad_image_url,
          landing_page_url: selectedCreative.landing_page_url,
          creater_name: selectedCreative.creater_name,
          creater_image_url: selectedCreative.creater_image_url,
          impression_id: impressionId || undefined,
        },
      });
    } catch (error) {
      console.error('❌ [레시피 카드 광고 조회] 오류 발생:', error);
      return res.status(500).json({
        success: false,
        message: '레시피 카드 광고 조회 실패: 서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 가중치 기반 랜덤 선택 알고리즘
   * CPI, view_count, 남은 기간을 고려한 가중치 계산
   */
  private static selectCreativeByWeight(
    creatives: AdCreative[],
    campaigns: AdCampaign[],
  ): AdCreative | null {
    if (creatives.length === 0) {
      return null;
    }

    // 한국 표준시(KST) 기준 현재 날짜
    const now = getKSTDate();

    // 캠페인 정보를 Map으로 변환 (빠른 조회)
    const campaignMap = new Map<string, AdCampaign>();
    campaigns.forEach(c => campaignMap.set(c.campaign_id, c));

    // 각 소재의 가중치 계산
    const weights: Array<{creative: AdCreative; weight: number}> = [];

    // 최대값 계산 (정규화용)
    let maxCPI = 0;
    let maxViewCount = 0;
    let maxDaysLeft = 0;

    creatives.forEach(creative => {
      const campaign = campaignMap.get(creative.campaign_id || '');
      if (!campaign) return;

      const cpi = Number(campaign.cpi) || 0;
      const viewCount = campaign.view_count || 0;
      const endDate = toKSTDate(new Date(campaign.end_date));
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      maxCPI = Math.max(maxCPI, cpi);
      maxViewCount = Math.max(maxViewCount, viewCount);
      maxDaysLeft = Math.max(maxDaysLeft, daysLeft);
    });

    // 가중치 계산
    creatives.forEach(creative => {
      const campaign = campaignMap.get(creative.campaign_id || '');
      if (!campaign) return;

      const cpi = Number(campaign.cpi) || 0;
      const viewCount = campaign.view_count || 0;
      const endDate = toKSTDate(new Date(campaign.end_date));
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // CPI 가중치 (높을수록 좋음): 0.5 가중치
      const cpiWeight = maxCPI > 0 ? (cpi / maxCPI) * 0.5 : 0;

      // view_count 가중치 (낮을수록 좋음, 균등 분배): 0.3 가중치
      const viewCountWeight =
        maxViewCount > 0 ? (1 / (1 + viewCount / Math.max(maxViewCount, 1))) * 0.3 : 0.3;

      // 남은 기간 가중치 (적을수록 좋음, 기간 내 노출): 0.2 가중치
      const daysLeftWeight =
        maxDaysLeft > 0 ? (1 / (1 + daysLeft / Math.max(maxDaysLeft, 1))) * 0.2 : 0.2;

      // 최종 가중치
      const totalWeight = cpiWeight + viewCountWeight + daysLeftWeight;

      weights.push({
        creative,
        weight: Math.max(0.01, totalWeight), // 최소 가중치 보장
      });
    });

    if (weights.length === 0) {
      return null;
    }

    // 가중치 기반 랜덤 선택
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weights) {
      random -= item.weight;
      if (random <= 0) {
        return item.creative;
      }
    }

    // 폴백: 첫 번째 소재 반환
    return weights[0]?.creative || null;
  }

  /**
   * 일일 1회 제한 확인 (광고 노출)
   * 레시피 카드 광고의 경우, 같은 레시피에서 같은 광고를 본 경우에만 제한
   * @param user_id 사용자 ID
   * @param creative_id 광고 소재 ID
   * @param recipe_post_id 레시피 ID (레시피 카드 광고인 경우)
   * @returns 이미 오늘 노출했으면 true, 아니면 false
   */
  private static async hasViewedAdToday(
    user_id: string,
    creative_id?: string | null,
    recipe_post_id?: string | null,
  ): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const impressionRepository = AppDataSource.getRepository(AdImpression);
      const where: any = {
        user_id,
        timestamp: MoreThanOrEqual(today),
      };

      if (creative_id) {
        where.creative_id = creative_id;
      }

      // 레시피 카드 광고인 경우, 같은 레시피에서 같은 광고를 본 경우에만 제한
      // 다른 레시피에서 같은 광고를 보는 것은 허용 (각 레시피 작성자에게 크래딧 지급)
      if (recipe_post_id) {
        where.recipe_post_id = recipe_post_id;
      }

      const count = await impressionRepository.count({where});
      const hasViewed = count > 0;
      
      if (hasViewed) {
        console.log(`⏭️ [일일 노출 확인] 이미 오늘 노출함: user_id=${user_id}, creative_id=${creative_id}, recipe_post_id=${recipe_post_id}`);
      }
      
      return hasViewed;
    } catch (error) {
      console.error('❌ [일일 노출 확인] 오류:', error);
      return false; // 에러 시 제한하지 않음
    }
  }

  /**
   * 레시피 작성자에게 크래딧 지급 처리 (레시피 카드 광고용)
   * @param recipe_post_id 레시피 ID
   * @param viewer_id 광고를 본 사용자 ID
   * @param cpi 광고 CPI
   * @param impression_id 노출 ID
   */
  private static async processCreditForRecipeAuthor(
    recipe_post_id: string,
    viewer_id: string,
    cpi: number | string,
    impression_id: string,
  ): Promise<void> {
    try {
      // 레시피 작성자 조회
      const recipePostRepository = AppDataSource.getRepository(RecipePost);
      const recipePost = await recipePostRepository.findOne({
        where: {recipe_post_id},
        select: ['user_id'],
      });

      console.log(`🔍 [크래딧 지급] 레시피 작성자 조회 결과:`, {
        recipe_post_id,
        hasRecipePost: !!recipePost,
        recipeAuthorId: recipePost?.user_id,
        viewerId: viewer_id,
        isDifferent: recipePost?.user_id !== viewer_id,
      });

      if (!recipePost) {
        console.log(`⚠️ [크래딧 지급] 레시피를 찾을 수 없음: recipe_post_id=${recipe_post_id}`);
        return;
      }

      if (recipePost.user_id === viewer_id) {
        console.log(`⚠️ [크래딧 지급] 레시피 작성자와 광고를 본 사용자가 동일하므로 크래딧 지급하지 않음`);
        return;
      }

      const cpiValue = Number(cpi) || 0;
      if (cpiValue <= 0) {
        console.log(`⚠️ [크래딧 지급] CPI가 0이거나 유효하지 않음: cpi=${cpi}`);
        return;
      }

      console.log(`💰 [크래딧 지급] CPI 확인:`, {cpi: cpiValue, campaign_cpi: cpi});

      // 크래딧 지급
      await AdController.grantCreditToRecipeAuthor(
        recipePost.user_id,
        cpiValue,
        impression_id,
      );
    } catch (error) {
      console.error('❌ [크래딧 지급 처리] 오류:', error);
      throw error;
    }
  }

  /**
   * 크래딧 지급 (레시피 작성자에게)
   * @param recipe_author_id 레시피 작성자 ID
   * @param cpi 광고 CPI
   * @param impression_id 노출 ID
   */
  private static async grantCreditToRecipeAuthor(
    recipe_author_id: string,
    cpi: number,
    impression_id: string,
  ): Promise<void> {
    try {
      console.log(`💰 [크래딧 지급 시작] recipe_author_id=${recipe_author_id}, cpi=${cpi}, impression_id=${impression_id}`);
      
      // 일일 1회 제한 확인 (크래딧 획득)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const creditTransactionRepository = AppDataSource.getRepository(CreditTransaction);
      const existingCredit = await creditTransactionRepository.findOne({
        where: {
          user_id: recipe_author_id,
          type: 'ad_revenue',
          created_at: MoreThanOrEqual(today),
        },
      });

      if (existingCredit) {
        // 이미 오늘 크래딧을 받았으면 지급하지 않음
        console.log(`⏭️ [크래딧 지급] 레시피 작성자 ${recipe_author_id}는 이미 오늘 크래딧을 받았습니다.`);
        return;
      }

      // 크래딧 계산 (CPI의 30%)
      const creditAmount = Number(cpi) * 0.3;
      console.log(`💰 [크래딧 계산] CPI=${cpi}, 크래딧=${creditAmount}`);

      // user_credits 테이블에 크래딧 추가 또는 생성
      const userCreditRepository = AppDataSource.getRepository(UserCredit);
      let userCredit = await userCreditRepository.findOne({
        where: {user_id: recipe_author_id},
      });

      const previousBalance = userCredit ? Number(userCredit.balance) : 0;

      if (!userCredit) {
        console.log(`📝 [크래딧 지급] 새로운 user_credits 레코드 생성`);
        userCredit = userCreditRepository.create({
          user_id: recipe_author_id,
          balance: creditAmount,
        });
      } else {
        console.log(`📝 [크래딧 지급] 기존 user_credits 업데이트: ${previousBalance} -> ${previousBalance + creditAmount}`);
        userCredit.balance = Number(userCredit.balance) + creditAmount;
      }

      await userCreditRepository.save(userCredit);
      console.log(`✅ [크래딧 지급] user_credits 저장 완료`);

      // 크래딧 거래 기록
      const creditTransaction = creditTransactionRepository.create({
        user_id: recipe_author_id,
        amount: creditAmount,
        type: 'ad_revenue',
        source_impression_id: impression_id,
      });

      await creditTransactionRepository.save(creditTransaction);
      console.log(`✅ [크래딧 지급] credit_transactions 저장 완료`);

      console.log(
        `✅ [크래딧 지급 완료] 레시피 작성자 ${recipe_author_id}에게 ${creditAmount} 크래딧 지급 (CPI: ${cpi}, 이전 잔액: ${previousBalance}, 현재 잔액: ${Number(userCredit.balance)})`,
      );
    } catch (error) {
      console.error('❌ [크래딧 지급] 오류:', error);
      console.error('❌ [크래딧 지급] 오류 스택:', (error as Error).stack);
      // 크래딧 지급 실패는 조용히 처리
      throw error; // 디버깅을 위해 에러를 다시 throw
    }
  }

  /**
   * 광고 노출 기록 (공개 API)
   * POST /api/ads/impressions
   */
  static async recordImpression(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id || null;
      const {creative_id, recipe_post_id} = req.body;

      if (!creative_id) {
        return res.status(400).json({
          success: false,
          message: '광고 소재 ID가 필요합니다.',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '로그인이 필요합니다.',
        });
      }

      const impressionId = await AdController.recordImpressionInternal(
        creative_id,
        userId,
        recipe_post_id || null,
      );

      if (!impressionId) {
        return res.json({
          success: true,
          message: '이미 오늘 노출된 광고입니다.',
          data: {impression_id: null},
        });
      }

      return res.json({
        success: true,
        message: '노출이 기록되었습니다.',
        data: {impression_id: impressionId},
      });
    } catch (error) {
      console.error('❌ [광고 노출 기록] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: (error as Error).message,
      });
    }
  }

  /**
   * 광고 노출 기록 (내부 메서드)
   */
  private static async recordImpressionInternal(
    creative_id: string,
    user_id: string,
    recipe_post_id: string | null | undefined,
  ): Promise<string | undefined> {
    try {
      // 일일 1회 제한 확인 (레시피 카드 광고인 경우 recipe_post_id도 전달)
      const hasViewed = await AdController.hasViewedAdToday(user_id, creative_id, recipe_post_id);
      if (hasViewed) {
        console.log(`⏭️ [광고 노출] 사용자 ${user_id}는 이미 오늘 이 광고를 본 적이 있습니다. (creative_id=${creative_id}, recipe_post_id=${recipe_post_id})`);
        return undefined; // 노출 기록하지 않음
      }

      const impressionRepository = AppDataSource.getRepository(AdImpression);

      // 노출 기록 생성
      const impression = impressionRepository.create({
        creative_id,
        user_id,
        recipe_post_id: recipe_post_id || null,
        clicked: false,
      } as any);

      const savedImpression = (await impressionRepository.save(impression)) as unknown as AdImpression;

      // 캠페인의 view_count 증가 및 크래딧 지급
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creative = await creativeRepository.findOne({
        where: {creative_id},
        relations: ['campaign'],
      });

      console.log(`🔍 [광고 노출 기록] creative 조회 결과:`, {
        creative_id,
        hasCreative: !!creative,
        hasCampaign: !!creative?.campaign,
        ad_type: creative?.ad_type,
        recipe_post_id,
        user_id,
      });

      if (creative?.campaign) {
        const campaignRepository = AppDataSource.getRepository(AdCampaign);
        await campaignRepository.increment(
          {campaign_id: creative.campaign.campaign_id},
          'view_count',
          1,
        );

        // 예산 초과 체크 및 자동 종료
        // 노출 기록 후 업데이트된 캠페인 정보를 다시 조회하여 예산 체크
        const updatedCampaign = await campaignRepository.findOne({
          where: {campaign_id: creative.campaign.campaign_id},
        });

        if (updatedCampaign && updatedCampaign.status === 'ACTIVE') {
          const spent = Number(updatedCampaign.view_count) * Number(updatedCampaign.cpi);
          const totalBudget = Number(updatedCampaign.total_budget);

          if (spent >= totalBudget) {
            // 예산 초과 시 캠페인 자동 종료
            await campaignRepository.update(
              {campaign_id: creative.campaign.campaign_id},
              {status: 'COMPLETED'},
            );
            console.log(`✅ [캠페인 자동 종료] 캠페인 ${creative.campaign.campaign_id}가 예산 초과로 자동 종료되었습니다. (소진: ${spent}, 예산: ${totalBudget})`);
          }
        }

        // 레시피 카드 광고인 경우 레시피 작성자에게 크래딧 지급
        if (recipe_post_id && creative.ad_type === 2) {
          console.log(`💰 [크래딧 지급] 레시피 카드 광고 감지: recipe_post_id=${recipe_post_id}, ad_type=${creative.ad_type}`);
          
          // 크래딧 지급은 비동기로 실행 (실패해도 노출 기록은 유지)
          AdController.processCreditForRecipeAuthor(
            recipe_post_id,
            user_id,
            creative.campaign.cpi,
            savedImpression.impression_id,
          ).catch(err => {
            console.error('❌ [크래딧 지급] 비동기 처리 오류 (노출 기록은 유지):', err);
          });
        } else {
          if (!recipe_post_id) {
            console.log(`⚠️ [크래딧 지급] recipe_post_id가 없음 (피드 광고일 수 있음)`);
          } else if (creative.ad_type !== 2) {
            console.log(`⚠️ [크래딧 지급] 레시피 카드 광고가 아님: ad_type=${creative.ad_type}`);
          }
        }
      } else {
        console.log(`⚠️ [크래딧 지급] creative 또는 campaign이 없음`);
      }

      return savedImpression.impression_id;
    } catch (error) {
      console.error('❌ [광고 노출 기록] 오류:', error);
      // 노출 기록 실패는 조용히 처리 (광고는 정상 반환)
      return undefined;
    }
  }

  /**
   * 광고 클릭 기록
   * POST /api/ads/clicks
   */
  static async recordClick(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id || null;
      const {creative_id, impression_id, recipe_post_id} = req.body;

      if (!creative_id) {
        return res.status(400).json({
          success: false,
          message: '광고 소재 ID가 필요합니다.',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '로그인이 필요합니다.',
        });
      }

      const clickRepository = AppDataSource.getRepository(AdClick);

      // 클릭 기록 생성
      const click = clickRepository.create({
        creative_id,
        user_id: userId,
        impression_id: impression_id || null,
      });

      await clickRepository.save(click);

      // impression의 clicked 플래그 업데이트
      if (impression_id) {
        const impressionRepository = AppDataSource.getRepository(AdImpression);
        await impressionRepository.update(
          {impression_id},
          {clicked: true},
        );
      }

      // 캠페인의 click_count 증가
      const creativeRepository = AppDataSource.getRepository(AdCreative);
      const creative = await creativeRepository.findOne({
        where: {creative_id},
        relations: ['campaign'],
      });

      if (creative?.campaign) {
        const campaignRepository = AppDataSource.getRepository(AdCampaign);
        await campaignRepository.increment(
          {campaign_id: creative.campaign.campaign_id},
          'click_count',
          1,
        );
      }

      return res.json({
        success: true,
        message: '클릭이 기록되었습니다.',
        data: {
          click_id: click.click_id,
        },
      });
    } catch (error) {
      console.error('❌ [광고 클릭 기록] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
      });
    }
  }
}

