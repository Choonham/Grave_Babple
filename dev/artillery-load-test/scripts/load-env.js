// Artillery Processor: 환경 변수 로드
const fs = require('fs');
const path = require('path');

console.log('[PROCESSOR] load-env.js is being loaded!');

// .env 파일 파싱 함수
function loadEnv() {
  // 프로젝트 루트에서 .env 찾기
  const envPath = path.join(__dirname, '..', '.env');
  
  console.log('[PROCESSOR] Looking for .env at:', envPath);
  
  if (!fs.existsSync(envPath)) {
    console.error('[PROCESSOR ERROR] .env file not found at:', envPath);
    return {};
  }
  
  console.log('[PROCESSOR] .env file found!');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        env[key.trim()] = value;
        if (key.trim() === 'AUTH_TOKEN') {
          console.log('[PROCESSOR] Found AUTH_TOKEN (first 30 chars):', value.substring(0, 30));
        }
      }
    }
  });
  
  console.log('[PROCESSOR] Loaded environment variables:', Object.keys(env));
  
  return env;
}

// 전역 env 로드
const globalEnv = loadEnv();

// 초기화 함수
module.exports = {
  // Artillery가 시나리오 실행 전에 호출
  beforeScenario: function(context, ee, next) {
    console.log('\n[PROCESSOR] ========================================');
    console.log('[PROCESSOR] beforeScenario called!');
    console.log('[PROCESSOR] Context vars before:', Object.keys(context.vars));
    
    if (globalEnv.AUTH_TOKEN) {
      context.vars.authToken = globalEnv.AUTH_TOKEN;
      console.log('[PROCESSOR] ✅ authToken set! (first 30 chars):', globalEnv.AUTH_TOKEN.substring(0, 30));
    } else {
      console.error('[PROCESSOR ERROR] ❌ AUTH_TOKEN not found in .env!');
      context.vars.authToken = 'YOUR_TOKEN_HERE';
    }
    
    console.log('[PROCESSOR] Context vars after:', Object.keys(context.vars));
    console.log('[PROCESSOR] authToken value:', context.vars.authToken ? context.vars.authToken.substring(0, 30) + '...' : 'undefined');
    console.log('[PROCESSOR] ========================================\n');
    
    return next();
  }
};

