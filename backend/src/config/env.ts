import {config} from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const result = config({path: envPath});

if (result.error) {
  console.warn('⚠️ [환경설정] .env 파일 로드 실패:', result.error);
} else {
  console.log('✅ [환경설정] .env 파일 로드 완료');
  console.log('   - 로드된 변수 수:', Object.keys(result.parsed || {}).length);
  console.log('   - DB_HOST:', process.env.DB_HOST || '(없음)');
  console.log('   - DB_USERNAME:', process.env.DB_USERNAME || '(없음)');
  console.log(
    '   - DB_PASSWORD:',
    process.env.DB_PASSWORD ? `*** (길이: ${process.env.DB_PASSWORD.length})` : '(없음)',
  );
  console.log('   - DB_NAME:', process.env.DB_NAME || '(없음)');
  console.log('   - SMTP_HOST:', process.env.SMTP_HOST || '(미설정)');
  console.log('   - SMTP_USER:', process.env.SMTP_USER || '(미설정)');
}


