/**
 * API 설정 파일
 * 환경에 따라 다른 백엔드 URL 사용
 * - 로컬 Docker: http://choonhost.zapto.org
 * - 서버: https://babpleAlpha.slowflowsoft.com (Nginx를 통해, SSL 적용)
 */

/**
 * 환경에 따른 API Base URL 설정
 */
const getApiBaseUrl = (): string => {
  // 프로덕션 빌드(Release)에서는 서버 URL 사용 (Nginx를 통해, SSL 적용)
  if (!__DEV__) {
    return 'https://babpleAlpha.slowflowsoft.com';
  }
  
  // 개발 환경(Development)에서는 로컬 Docker URL 사용
  return 'https://babpleAlpha.slowflowsoft.com';
};

/**
 * API Base URL (Nginx를 통해 접근, 포트 없음)
 */
export const API_BASE_URL = getApiBaseUrl();

/**
 * Web Base URL
 */ 
export const WEB_BASE_URL = getApiBaseUrl();

/**
 * API 엔드포인트 (Base URL + /api)
 * Nginx가 /api를 backend로 프록시하므로 포트 없이 사용
 */
export const API_ENDPOINT = `${API_BASE_URL}/api`;

console.log('📱 [API Config] Base URL:', API_BASE_URL);
console.log('📱 [API Config] API Endpoint:', API_ENDPOINT);
console.log('📱 [API Config] Web Base URL:', WEB_BASE_URL);
console.log('📱 [API Config] Development Mode:', __DEV__);

