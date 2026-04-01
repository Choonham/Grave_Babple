import fs from 'fs';

/**
 * 업로드 디렉토리 설정
 * 환경 변수 UPLOAD_PATH 사용 (Docker: /app/uploads, 로컬: C:\babpleUpload)
 * 모든 업로드 관련 코드에서 이 값을 사용하여 일관성 유지
 */
export const uploadDir = process.env.UPLOAD_PATH || (process.platform === 'win32' ? 'C:\\babpleUpload' : '/app/uploads');

// 디렉토리가 없으면 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {recursive: true});
  console.log(`📁 [업로드 설정] 업로드 디렉토리 생성: ${uploadDir}`);
} else {
  console.log(`📁 [업로드 설정] 업로드 디렉토리 확인: ${uploadDir}`);
}

