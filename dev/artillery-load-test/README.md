# 🎯 Babple Artillery 부하 테스트 완벽 가이드

Windows 로컬 환경에서 원격 서버 (https://babpleAlpha.slowflowsoft.com)를 테스트합니다.

---

## 📋 목차
- [빠른 시작](#-빠른-시작-3단계)
- [테스트 시나리오](#-테스트-시나리오)
- [결과 분석](#-결과-분석)
- [주의사항](#️-중요-주의사항)
- [문제 해결](#-트러블슈팅)

---

## 🚀 빠른 시작 (3단계)

### 1️⃣ Artillery 설치

```powershell
cd C:\files\Dev\babple\dev\dev\artillery-load-test
npm install
```

### 2️⃣ 인증 토큰 발급

```powershell
npm run token
```

또는

```powershell
powershell -ExecutionPolicy Bypass -File scripts\get-token.ps1
```

> **✨ 자동 업데이트:** `npm run token` 실행 시 `.env` 파일과 **모든 시나리오 파일**이 자동으로 업데이트됩니다!  
> **⏰ 토큰 만료:** JWT 토큰은 24시간 후 만료됩니다. 만료되면 다시 `npm run token`을 실행하세요.

### 3️⃣ 테스트 실행

**방법 1: 빠른 시작 메뉴 (추천)**
```powershell
.\quick-start.bat
```

**방법 2: 개별 테스트 실행**
```powershell
npm run test:feed     # 피드 조회 (5분)
npm run test:detail   # 레시피 상세 (4분)
npm run test:mixed    # 실전 혼합 시나리오 (12분)
```

---

## 📊 테스트 시나리오

### ⚠️ Rate Limit 주의사항

서버에 **Rate Limit**이 적용되어 있어 부하를 낮게 설정했습니다:
- **200개 요청 성공** → 이후 429 에러 발생 확인됨
- 모든 시나리오는 Rate Limit을 고려하여 조정됨

### 1️⃣ 피드 조회 테스트 (`feed.yml`)

**HomeScreen에서 피드 불러오기**

```powershell
npm run test:feed
```

| 단계 | 시간 | 부하 | 설명 |
|-----|------|------|------|
| Warm-up | 30초 | 2 req/s | 준비 운동 |
| Ramp-up | 60초 | 2→5 req/s | 점진적 증가 |
| Sustained | 120초 | 5 req/s | 지속 부하 |
| Peak | 60초 | 8 req/s | 최대 부하 |
| Cool down | 30초 | 2 req/s | 정리 |

**총 소요 시간**: 약 5분  
**총 요청 수**: 약 1,500개

**시나리오 구성**:
- 70%: 기본 피드 조회
- 20%: 새로고침 (Pull to Refresh)
- 10%: 인증 실패 테스트

### 2️⃣ 레시피 상세 조회 (`recipe-detail.yml`)

**RecipeDetailModal 상세 페이지**

```powershell
npm run test:detail
```

| 단계 | 시간 | 부하 | 설명 |
|-----|------|------|------|
| Low load | 30초 | 1 req/s | 소규모 |
| Medium load | 60초 | 1→3 req/s | 중규모 |
| High load | 90초 | 3 req/s | 고부하 |
| Spike | 20초 | 5 req/s | 스파이크 |
| Cool down | 20초 | 1 req/s | 정리 |

**총 소요 시간**: 약 4분  
**총 요청 수**: 약 500개

**시나리오 구성**:
- 60%: 레시피 조회만
- 30%: 레시피 조회 + 좋아요
- 10%: 레시피 조회 + 댓글 작성

### 3️⃣ 레시피 등록 테스트 (`recipe-upload.yml`)

**PostRecipeScreen 레시피 작성**

```powershell
npm run test:upload
```

⚠️ **경고**: 이 테스트는 실제 서버에 데이터를 생성합니다!

| 단계 | 시간 | 부하 |
|-----|------|------|
| Low write | 60초 | 1 req/s |
| Medium write | 60초 | 3 req/s |
| Peak write | 30초 | 5 req/s |
| Cool down | 30초 | 1 req/s |

**총 소요 시간**: 약 3분  
**총 생성 데이터**: 약 400개 레시피

**시나리오 구성**:
- 80%: 간단한 레시피 (이미지 없음)
- 20%: 이미지 포함 레시피

### 4️⃣ 실전 혼합 시나리오 (`mixed-scenario.yml`) ⭐ 추천

**실제 사용자 행동 패턴**

```powershell
npm run test:mixed
```

| 시간대 | 시간 | 부하 | 설명 |
|-------|------|------|------|
| 아침 | 2분 | 2→5 req/s | 출근길 |
| 점심 | 3분 | 5→8 req/s | 점심 시간 |
| 저녁 | 4분 | 8→10 req/s | 저녁 피크 |
| 밤 | 2분 | 5→2 req/s | 밤 시간 |
| 새벽 | 1분 | 1 req/s | 새벽 |

**총 소요 시간**: 약 12분  
**총 요청 수**: 약 4,000개

**시나리오 구성**:
- 50%: 캐주얼 사용자 (보기만)
- 30%: 액티브 사용자 (좋아요/댓글)
- 20%: 검색 사용자

---

## 📈 결과 분석

### HTML 리포트 생성

```powershell
# 최신 결과 리포트
npm run report

# 또는 Artillery 명령어로
npx artillery report results\feed-20250101-143022.json
```

### 주요 메트릭 해석

#### ✅ 성공 기준

| 메트릭 | 우수 | 보통 | 나쁨 | 설명 |
|--------|------|------|------|------|
| **p95** | < 500ms | < 1000ms | > 1000ms | 95%의 요청이 이 시간 안에 완료 |
| **p99** | < 1000ms | < 2000ms | > 2000ms | 99%의 요청이 이 시간 안에 완료 |
| **에러율** | < 1% | < 5% | > 5% | 실패한 요청의 비율 |
| **처리량** | > 50 req/s | > 20 req/s | < 20 req/s | 초당 처리 요청 수 |

#### 📊 결과 예시

```
✅ 좋은 결과 예시:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
http.codes.200 ................... 1450
http.codes.429 ................... 50   ⚠️ Rate Limit (정상)
http.codes.500 ................... 0

Response Time:
  min ............................ 45ms
  max ............................ 890ms
  median ......................... 156ms
  p95 ............................ 456ms ✅
  p99 ............................ 678ms ✅

Request Rate ..................... 47/sec
Error Rate (excluding 429) ....... 0.0% ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### HTTP 상태 코드

- **200**: 성공
- **401**: 인증 실패 (토큰 재발급 필요)
- **429**: Rate Limit 초과 (정상, 서버 보호 기능)
- **500**: 서버 에러 (문제!)

---

## ⚠️ 중요 주의사항

### 1. Rate Limit이 적용되어 있습니다

현재 서버는 **Rate Limit**이 설정되어 있습니다:
- 약 **200개 요청 성공** 후 429 에러 발생 확인
- 이는 **정상적인 동작**입니다 (서버 보호 메커니즘)
- 429 에러는 실패로 카운트하지 않습니다

### 2. 실제 프로덕션 서버

- 이 테스트는 **실제 운영 서버**에 부하를 줍니다
- 서비스 사용 중인 시간대는 **피해주세요**
- **새벽 시간대**(오전 2-6시) 권장

### 3. 레시피 등록 테스트 주의

- `test:upload`는 실제 DB에 **데이터를 생성**합니다
- 테스트 후 서버 관리자에게 정리 요청
- 또는 DB에서 `title LIKE '부하 테스트%'` 레시피 삭제

### 4. 토큰 만료

- JWT 토큰은 **24시간** 후 만료됩니다
- 401 에러 발생 시: `npm run token` 재실행

---

## 🔧 트러블슈팅

### 문제 1: "401 Unauthorized"

**증상**: 모든 요청이 401 에러

**원인**: JWT 토큰 만료

**해결**:
```powershell
npm run token
```

---

### 문제 2: "429 Too Many Requests" 대량 발생

**증상**: 
```
http.codes.200: 198
http.codes.429: 402  ← 많음
```

**원인**: Rate Limit 도달

**해결책**:

1. **시나리오 부하 낮추기** (이미 적용됨)
2. **대기 시간 늘리기**
```yaml
# scenarios/*.yml 파일에서
- think: 5  # 2 → 5로 변경
```
3. **Phase 조정**
```yaml
phases:
  - duration: 60
    arrivalRate: 1  # 2 → 1로 낮춤
```

---

### 문제 3: "ENOTFOUND" 연결 실패

**증상**:
```
Error: getaddrinfo ENOTFOUND babplealpha.slowflowsoft.com
```

**원인**:
- 인터넷 연결 문제
- 서버 다운
- DNS 문제

**해결**:
1. 브라우저에서 https://babpleAlpha.slowflowsoft.com 접속 확인
2. 인터넷 연결 확인
3. VPN 확인
4. 방화벽 확인

---

### 문제 4: "ETIMEDOUT" 타임아웃

**증상**: 요청이 너무 느림

**원인**: 
- 서버 과부하
- 네트워크 지연

**해결**:
1. 부하 낮추기
2. 타임아웃 늘리기
```yaml
# scenarios/*.yml
http:
  timeout: 30  # 20 → 30으로
```

---

### 문제 5: PowerShell 실행 정책 에러

**증상**:
```
... cannot be loaded because running scripts is disabled
```

**해결**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📦 NPM 스크립트 전체 목록

```powershell
npm run test:feed       # 피드 조회 (5분, 1,500 req)
npm run test:detail     # 레시피 상세 (4분, 500 req)
npm run test:upload     # 레시피 등록 (3분, 400 req) ⚠️
npm run test:mixed      # 실전 혼합 (12분, 4,000 req) ⭐
npm run test:all        # 위 모든 테스트 순차 실행
npm run report          # HTML 리포트 생성
npm run token           # 인증 토큰 재발급
npm run cleanup         # 테스트 데이터 정리 (미구현)
```

---

## 📊 성능 목표

### 엔드포인트별 목표 (Rate Limit 고려)

| 엔드포인트 | 목표 처리량 | p95 목표 | p99 목표 | 비고 |
|-----------|------------|---------|---------|------|
| 피드 조회 | 5-8 req/s | < 500ms | < 1000ms | Rate Limit 주의 |
| 레시피 상세 | 3-5 req/s | < 1000ms | < 2000ms | |
| 레시피 등록 | 1-3 req/s | < 5000ms | < 10000ms | 이미지 처리 시간 |

### 예상 병목 지점

1. **Rate Limit** ⭐ 가장 중요
   - 현재 ~200 req 후 429 발생
   - 서버 설정 확인 필요

2. **DB 커넥션 풀**
   - 동시 접속자 많을 때
   - `pg_stat_activity` 확인

3. **이미지 업로드/처리**
   - S3 업로드 시간
   - Sharp 이미지 리사이징

4. **네트워크 지연**
   - 로컬 → 원격 서버
   - 정상 지연: 50-200ms

---

## 🎓 Artillery 기본 개념

### Phases (부하 단계)

```yaml
phases:
  - duration: 60        # 60초 동안
    arrivalRate: 10     # 초당 10명의 가상 사용자 생성
    rampTo: 50          # 점진적으로 50명까지 증가
    name: "Ramp up"     # 단계 이름
```

### Scenarios (시나리오)

```yaml
scenarios:
  - name: "User Flow"
    weight: 70          # 전체 요청의 70%
    flow:
      - get:
          url: "/api/recipes/feed"
      - think: 5        # 5초 대기 (사용자 읽는 시간)
      - post:
          url: "/api/recipes/1/like"
```

### Variables (변수)

```yaml
variables:
  authToken: "{{ $processEnvironment.AUTH_TOKEN }}"  # .env 파일에서
```

### Capture (응답 추출)

```yaml
capture:
  - json: "$.data[0].recipe_post_id"
    as: "recipeId"        # 나중에 {{ recipeId }}로 사용
```

### Expect (검증)

```yaml
expect:
  - statusCode: 200
  - contentType: json
  - hasProperty: success
```

---

## 📁 디렉토리 구조

```
dev/artillery-load-test/
├── .env                    # 환경 변수 (토큰 포함)
├── .gitignore              # Git 제외 파일
├── package.json            # NPM 설정
├── README.md               # 이 파일
├── QUICKSTART.md           # 빠른 시작 가이드
├── quick-start.bat         # Windows 빠른 시작
├── scenarios/              # 테스트 시나리오
│   ├── feed.yml            # 피드 조회
│   ├── recipe-detail.yml   # 레시피 상세
│   ├── recipe-upload.yml   # 레시피 등록
│   └── mixed-scenario.yml  # 실전 혼합
├── scripts/                # 유틸리티 스크립트
│   └── get-token.ps1       # 토큰 발급
└── results/                # 테스트 결과 (자동 생성)
    ├── feed-*.json
    └── *.html
```

---

## 🔍 고급 사용법

### 1. 커스텀 Phase로 실행

```powershell
# 10초 동안 초당 5명
npx artillery quick --duration 10 --rate 5 https://babpleAlpha.slowflowsoft.com/api/recipes/feed
```

### 2. 환경 변수 오버라이드

```powershell
$env:BASE_URL="https://babpleAlpha.slowflowsoft.com/api"
$env:AUTH_TOKEN="your-token"
npm run test:feed
```

### 3. 특정 시나리오만 실행

```powershell
# feed.yml의 특정 시나리오만
npx artillery run scenarios\feed.yml --scenario-name "Feed - Basic Load"
```

### 4. 결과를 JSON으로 저장

```powershell
npx artillery run scenarios\feed.yml `
  --output results\my-test.json
```

### 5. 실시간 모니터링 (Artillery Pro)

```powershell
# Artillery Cloud 계정 필요 (무료 트라이얼 가능)
npx artillery run --record scenarios\feed.yml
```

---

## 📞 문의 및 지원

문제 발생 시 다음 정보를 포함하여 문의하세요:

1. **Artillery 버전**:
```powershell
npx artillery --version
```

2. **에러 메시지 전체**

3. **실행한 명령어**

4. **.env 파일 내용** (토큰 제외)

5. **서버 응답 로그** (있다면)

---

## ✅ 체크리스트

테스트 실행 전 확인:

- [ ] Artillery 설치 완료 (`npm install`)
- [ ] `.env` 파일 존재 확인
- [ ] 토큰 발급 완료 (`npm run token`)
- [ ] 서버 정상 작동 확인 (브라우저 접속)
- [ ] 테스트 시간대 확인 (새벽 추천)
- [ ] Rate Limit 인지함
- [ ] `recipe-upload` 테스트 주의 사항 이해

테스트 실행 후:

- [ ] 결과 리포트 생성 (`npm run report`)
- [ ] 에러율 확인 (429 제외)
- [ ] p95/p99 메트릭 확인
- [ ] 병목 지점 파악
- [ ] 테스트 데이터 정리 (upload 실행 시)

---

## 🎉 Happy Load Testing!

서버 성능을 최적화하고 사용자 경험을 개선하세요! 🚀

**다음 단계**:
1. 이 테스트 결과를 바탕으로 서버 Rate Limit 조정
2. DB 인덱스 최적화
3. 캐싱 전략 수립
4. CDN 도입 검토
