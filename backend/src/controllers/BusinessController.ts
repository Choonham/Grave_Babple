import {Request, Response} from 'express';
import axios from 'axios';

/**
 * 사업자 등록번호 조회 컨트롤러
 * 외부 API를 통해 사업자 정보를 조회합니다.
 */
export class BusinessController {
  /**
   * 사업자 등록번호 조회
   * POST /api/business/inquire
   * 
   * 외부 API 준비 절차:
   * 1. 사업자 등록번호 조회 API 서비스 선택 (예: 공공데이터포털, 사업자등록번호 조회 서비스 등)
   * 2. API 키 발급 및 환경 변수 설정 (.env 파일에 BUSINESS_API_KEY 추가)
   * 3. 아래 코드에서 외부 API 호출 부분을 실제 API에 맞게 수정
   */
  static async inquireBusiness(req: Request, res: Response) {
    try {
      console.log('📋 [사업자 조회] 컨트롤러 요청 받음');
      console.log('📋 [사업자 조회] 요청 Body:', JSON.stringify(req.body, null, 2));

      const {business_number} = req.body;

      if (!business_number) {
        return res.status(400).json({
          success: false,
          message: '사업자 등록번호를 입력해주세요.',
        });
      }

      // 사업자 등록번호 형식 검증 (10자리 숫자)
      const cleanedNumber = business_number.replace(/[-\s]/g, '');
      if (!/^\d{10}$/.test(cleanedNumber)) {
        return res.status(400).json({
          success: false,
          message: '사업자 등록번호는 10자리 숫자여야 합니다.',
        });
      }

      // TODO: 외부 API 호출 부분
      // 아래는 예시 코드입니다. 실제 사용할 API에 맞게 수정하세요.
      
      // 예시 1: 공공데이터포털 사업자등록번호 조회 API
      // const apiKey = process.env.BUSINESS_API_KEY;
      // if (!apiKey) {
      //   return res.status(500).json({
      //     success: false,
      //     message: '사업자 조회 API 설정이 필요합니다.',
      //   });
      // }
      // 
      // const response = await axios.get('https://api.example.com/business/inquire', {
      //   params: {
      //     b_no: cleanedNumber,
      //   },
      //   headers: {
      //     'Authorization': `Bearer ${apiKey}`,
      //   },
      //   timeout: 10000,
      // });
      //
      // const businessData = response.data;
      // return res.json({
      //   success: true,
      //   message: '사업자 정보를 조회했습니다.',
      //   data: {
      //     trade_name: businessData.corpNm || businessData.companyName,
      //     representative: businessData.representative || businessData.ceoName,
      //   },
      // });

      // 예시 2: 다른 사업자 조회 서비스
      // const apiKey = process.env.BUSINESS_API_KEY;
      // const response = await axios.post('https://api.example.com/business/verify', {
      //   business_number: cleanedNumber,
      // }, {
      //   headers: {
      //     'X-API-Key': apiKey,
      //   },
      //   timeout: 10000,
      // });

      // 현재는 개발용 더미 응답
      // 실제 API 연동 시 아래 코드를 제거하고 위의 예시 코드를 활성화하세요.
      console.log('⚠️ [사업자 조회] 외부 API 미연동 상태 - 더미 데이터 반환');
      console.log('💡 [사업자 조회] 외부 API 연동 필요:');
      console.log('   1. .env 파일에 BUSINESS_API_KEY 추가');
      console.log('   2. BusinessController.ts의 외부 API 호출 코드 수정');
      console.log('   3. 실제 API 응답 형식에 맞게 데이터 파싱');

      // 더미 응답 (개발용)
      return res.json({
        success: true,
        message: '사업자 정보를 조회했습니다. (개발용 더미 데이터)',
        data: {
          trade_name: '(주) 웅이 식자재마트',
          representative: '웅이',
        },
      });

      // 실제 API 연동 시 아래 주석을 해제하고 위의 더미 응답을 제거하세요.
      // return res.json({
      //   success: true,
      //   message: '사업자 정보를 조회했습니다.',
      //   data: {
      //     trade_name: businessData.trade_name || businessData.company_name,
      //     representative: businessData.representative || businessData.ceo_name,
      //   },
      // });
    } catch (error: any) {
      console.error('❌ [사업자 조회] 오류 발생:', error);
      console.error('❌ [사업자 조회] 오류 상세:', (error as Error).message);
      console.error('❌ [사업자 조회] 오류 스택:', (error as Error).stack);

      // 외부 API 오류 처리
      if (error.response) {
        // 외부 API에서 오류 응답
        return res.status(error.response.status || 500).json({
          success: false,
          message: error.response.data?.message || '사업자 정보 조회에 실패했습니다.',
        });
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못함
        return res.status(503).json({
          success: false,
          message: '사업자 조회 서비스에 연결할 수 없습니다.',
        });
      } else {
        // 요청 설정 중 오류
        return res.status(500).json({
          success: false,
          message: '사업자 정보 조회 중 오류가 발생했습니다.',
          error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        });
      }
    }
  }
}

