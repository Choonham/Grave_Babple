import { DataSource } from 'typeorm';

// 데이터베이스 연결 설정
// 환경 변수에서 가져오고, 없으면 기본값 사용

const dbConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres',
  extra: {
    max: 150, // 커넥션 풀 크기 증설 (기본값 10 -> 50)
    connectionTimeoutMillis: 10000, // 연결 타임아웃 10초
  },
};

if (process.env.NODE_ENV === 'development') {
  console.log('   - host:', dbConfig.host);
  console.log('   - port:', dbConfig.port);
  console.log('   - username:', dbConfig.username);
  console.log('   - password:', '***' + ` (길이: ${dbConfig.password.length})`);
  console.log('   - database:', dbConfig.database);
}

export const AppDataSource = new DataSource({
  ...dbConfig,
  synchronize: false, // 수동으로 스키마 관리
  logging: process.env.NODE_ENV === 'development', // 개발 환경에서만 로깅
  entities: [
    __dirname + '/../models/*.ts',
    __dirname + '/../models/*.js'
  ],
  migrations: [
    __dirname + '/migrations/*.ts',
    __dirname + '/migrations/*.js'
  ],
  subscribers: [
    __dirname + '/subscribers/*.ts',
    __dirname + '/subscribers/*.js'
  ],
  // SSL 설정: 프로덕션에서만 사용, 로컬 Docker에서는 비활성화
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * 데이터베이스 연결 초기화
 * 앱 시작 시 데이터베이스 연결을 설정합니다.
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // 연결 시도 전에 최종 설정 확인
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 [데이터베이스 연결] 연결 시도 중...');
      console.log('   - 사용하는 설정:');
      const options = AppDataSource.options as any;
      console.log('     * host:', options.host);
      console.log('     * port:', options.port);
      console.log('     * username:', options.username);
      console.log('     * password:', options.password ? `"***" (길이: ${options.password.length})` : 'undefined');
      console.log('     * database:', options.database);
    }

    await AppDataSource.initialize();
    console.log('✅ 데이터베이스 연결이 성공적으로 초기화되었습니다.');

    // 개발 환경에서만 테이블 생성 확인
    if (process.env.NODE_ENV === 'development') {
      const tables = await AppDataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log('📊 생성된 테이블:', tables.map((t: any) => t.table_name));
    }
  } catch (error) {
    console.error('❌ 데이터베이스 연결 초기화 중 오류가 발생했습니다:', error);
    console.error('   - 연결 시도한 설정:');
    const options = AppDataSource.options as any;
    console.error('     * host:', options.host);
    console.error('     * port:', options.port);
    console.error('     * username:', options.username);
    console.error('     * password:', options.password ? `"***" (길이: ${options.password.length})` : 'undefined');
    console.error('     * database:', options.database);
    throw error;
  }
};

/**
 * 데이터베이스 연결 종료
 * 앱 종료 시 데이터베이스 연결을 정리합니다.
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ 데이터베이스 연결이 정상적으로 종료되었습니다.');
    }
  } catch (error) {
    console.error('❌ 데이터베이스 연결 종료 중 오류가 발생했습니다:', error);
    throw error;
  }
};

export default AppDataSource;
