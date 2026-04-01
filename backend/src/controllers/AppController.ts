import {Request, Response} from 'express';
import {AppDataSource} from '../config/database';
import {EmailService} from '../services/EmailService';
import {TestApplication} from '../models/App';
import crypto from 'crypto';
import axios from 'axios';

/**
 * 앱 정보 컨트롤러
 */
export class AppController {
  /**
   * 고객센터 정보 조회
   * GET /api/app/customer-service
   */
  static async getCustomerServiceInfo(req: Request, res: Response) {
    try {
      // TODO: 실제로는 DB에서 가져오거나 설정 파일에서 가져올 수 있음
      // 현재는 하드코딩된 값 반환
      return res.json({
        success: true,
        data: {
          business_name: 'SlowFlow Soft',
          business_number: '713-08-03171',
          business_address: '인천광역시 남동구 남동서로 236번길 30, 222-A149호',
          customer_service_phone: '010-5618-0699',
          customer_service_email: 'babpleBiz@slowflowsoft.com',
          operating_hours: '연중무휴',
        },
      });
    } catch (error) {
      console.error('고객센터 정보 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '고객센터 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * QnA 목록 조회
   * GET /api/app/qna
   */
  static async getQnA(req: Request, res: Response) {
    try {
      // TODO: 실제로는 DB에서 QnA를 가져올 수 있음
      // 현재는 더미 데이터 반환
      return res.json({
        success: true,
        data: [
          {
            id: 1,
            question: '앱 사용 방법이 궁금해요',
            answer: '홈 화면에서 레시피를 확인하고, 좋아요와 댓글을 남길 수 있습니다.',
          },
          {
            id: 2,
            question: '레시피를 어떻게 등록하나요?',
            answer: '홈 화면 우측 상단의 + 버튼을 눌러 레시피를 등록할 수 있습니다.',
          },
          {
            id: 3,
            question: '채팅 기능은 어떻게 사용하나요?',
            answer: '홈 화면 우측 상단의 채팅 아이콘을 눌러 채팅 목록을 확인할 수 있습니다.',
          },
        ],
      });
    } catch (error) {
      console.error('QnA 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: 'QnA 목록을 불러오는 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 테스트 신청 제출
   * POST /api/app/test-application
   */
  static async submitTestApplication(req: Request, res: Response) {
    try {
      const {name, email, platform} = req.body;

      // 입력 검증
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '이름을 입력해주세요.',
        });
      }

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: '유효한 이메일 주소를 입력해주세요.',
        });
      }

      if (!platform || !['android', 'ios'].includes(platform)) {
        return res.status(400).json({
          success: false,
          message: '플랫폼을 선택해주세요.',
        });
      }

      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const platformType = platform as 'android' | 'ios';

      // DB에 저장
      const testApplicationRepository = AppDataSource.getRepository(TestApplication);
      const application = testApplicationRepository.create({
        name: trimmedName,
        email: trimmedEmail,
        platform: platformType,
        link_sent: false,
      });
      const savedApplication = await testApplicationRepository.save(application);

      // 관리자에게 메일 발송 (링크 포함)
      const adminLinkToken = crypto.randomBytes(32).toString('hex');
      const WEB_BASE_URL = process.env.WEB_BASE_URL || 'https://babplealpha.slowflowsoft.com';
      const adminLink = `${WEB_BASE_URL}/admin/test-link/${savedApplication.application_id}?token=${adminLinkToken}`;

      await EmailService.sendTestApplicationEmailToAdmin(
        trimmedName,
        trimmedEmail,
        platformType,
        savedApplication.application_id,
        adminLink,
      );

      // 신청자에게 안내 메일 발송
      await EmailService.sendTestApplicationConfirmationEmail(
        trimmedName,
        trimmedEmail,
        platformType,
      );

      console.log(`✅ [테스트 신청] 신청 완료: ${trimmedName} (${trimmedEmail}) - ${platformType}`);

      return res.json({
        success: true,
        message: '테스트 신청이 완료되었습니다. 곧 연락드리겠습니다.',
      });
    } catch (error) {
      console.error('테스트 신청 처리 오류:', error);
      return res.status(500).json({
        success: false,
        message: '테스트 신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    }
  }

  /**
   * 테스트 신청 정보 조회 (관리자)
   * GET /api/app/test-application/:applicationId
   */
  static async getTestApplication(req: Request, res: Response) {
    try {
      const {applicationId} = req.params;

      const testApplicationRepository = AppDataSource.getRepository(TestApplication);
      const application = await testApplicationRepository.findOne({
        where: {application_id: applicationId},
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: '테스트 신청을 찾을 수 없습니다.',
        });
      }

      return res.json({
        success: true,
        data: {
          application_id: application.application_id,
          name: application.name,
          email: application.email,
          platform: application.platform,
          test_link: application.test_link,
          link_sent: application.link_sent,
          link_sent_at: application.link_sent_at,
          created_at: application.created_at,
        },
      });
    } catch (error) {
      console.error('테스트 신청 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '테스트 신청 조회 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 테스트 링크 전송 (관리자)
   * POST /api/app/test-application/:applicationId/send-link
   */
  static async sendTestLink(req: Request, res: Response) {
    try {
      const {applicationId} = req.params;
      const {test_link} = req.body;

      if (!test_link || typeof test_link !== 'string' || test_link.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '테스트 링크를 입력해주세요.',
        });
      }

      const testApplicationRepository = AppDataSource.getRepository(TestApplication);
      const application = await testApplicationRepository.findOne({
        where: {application_id: applicationId},
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: '테스트 신청을 찾을 수 없습니다.',
        });
      }

      // DB 업데이트
      application.test_link = test_link.trim();
      application.link_sent = true;
      application.link_sent_at = new Date();
      await testApplicationRepository.save(application);

      // 신청자에게 테스트 링크 메일 발송
      await EmailService.sendTestLinkEmail(
        application.name,
        application.email,
        application.platform,
        test_link.trim(),
      );

      console.log(`✅ [테스트 링크 전송] ${application.name} (${application.email}) - ${application.platform}`);

      return res.json({
        success: true,
        message: '테스트 링크가 성공적으로 전송되었습니다.',
      });
    } catch (error) {
      console.error('테스트 링크 전송 오류:', error);
      return res.status(500).json({
        success: false,
        message: '테스트 링크 전송 중 오류가 발생했습니다.',
      });
    }
  }

  /**
   * 주소 검색 (카카오 로컬 API)
   * GET /api/app/address/search?query={검색어}&page={페이지}&size={크기}
   */
  static async searchAddress(req: Request, res: Response) {
    try {
      const {query, page = 1, size = 15} = req.query;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: '검색어는 2자 이상 입력해주세요.',
        });
      }

      const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
      if (!kakaoRestApiKey) {
        console.error('❌ [주소 검색] KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다.');
        return res.status(500).json({
          success: false,
          message: '서버 설정 오류가 발생했습니다.',
        });
      }

      const trimmedQuery = query.trim();
      const queryLower = trimmedQuery.toLowerCase();

      // 카카오 로컬 API 호출 (더 많은 결과를 가져오기 위해 size를 늘림)
      const response = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
        params: {
          query: trimmedQuery,
          page: parseInt(String(page), 10),
          size: Math.max(parseInt(String(size), 10) * 2, 30), // 부분 매칭을 위해 더 많은 결과 가져오기
        },
        headers: {
          Authorization: `KakaoAK ${kakaoRestApiKey}`,
        },
        timeout: 10000,
      });

      // 부분 매칭 필터링: 검색어가 주소의 일부에 포함된 결과만 필터링
      if (response.data?.documents && Array.isArray(response.data.documents)) {
        const filteredDocuments = response.data.documents.filter((doc: any) => {
          // 도로명 주소, 지번 주소, 전체 주소명에서 검색어 포함 여부 확인
          const roadAddress = doc.road_address?.address_name?.toLowerCase() || '';
          const address = doc.address?.address_name?.toLowerCase() || '';
          const addressName = doc.address_name?.toLowerCase() || '';
          const roadName = doc.road_address?.road_name?.toLowerCase() || '';

          // 검색어가 주소의 어느 부분에든 포함되어 있으면 포함
          return (
            roadAddress.includes(queryLower) ||
            address.includes(queryLower) ||
            addressName.includes(queryLower) ||
            roadName.includes(queryLower)
          );
        });

        // 요청한 size만큼만 반환
        const limitedDocuments = filteredDocuments.slice(0, parseInt(String(size), 10));

        return res.json({
          success: true,
          data: {
            ...response.data,
            documents: limitedDocuments,
            meta: {
              ...response.data.meta,
              total_count: filteredDocuments.length,
              pageable_count: filteredDocuments.length,
            },
          },
        });
      }

      return res.json({
        success: true,
        data: response.data,
      });
    } catch (error: any) {
      console.error('❌ [주소 검색] 오류:', error);

      let errorMessage = '주소 검색에 실패했습니다.';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;

        // 카카오 서비스 비활성화 오류인 경우
        if (errorMessage.includes('disabled') || errorMessage.includes('OPEN_MAP_AND_LOCAL')) {
          errorMessage = '카카오 로컬 서비스가 비활성화되어 있습니다.';
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'API 키가 올바르지 않습니다.';
      } else if (error.response?.status === 403) {
        errorMessage = 'API 키에 권한이 없습니다.';
      } else if (error.response?.status === 429) {
        errorMessage = '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return res.status(error.response?.status || 500).json({
        success: false,
        message: errorMessage,
      });
    }
  }
}

