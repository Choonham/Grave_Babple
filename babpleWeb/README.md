# Babple Web

Babple Web은 관리자 대시보드, 랜딩 페이지, 공유 페이지를 제공하는 웹 애플리케이션입니다.

## 기능

- **관리자 대시보드**: 유저 관리, 게시글 관리, 광고 관리
- **랜딩 페이지**: Babple 앱 소개 및 다운로드 링크
- **공유 페이지**: 레시피 공유 링크를 통한 레시피 조회

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

개발 서버는 `http://localhost:3001`에서 실행됩니다.

### 빌드

```bash
npm run build
```

빌드된 파일은 `dist` 디렉토리에 생성됩니다.

## 환경 변수

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```
VITE_API_BASE_URL=http://localhost:3000
```

## 라우팅

- `/` - 랜딩 페이지
- `/share/:recipeId` - 레시피 공유 페이지
- `/admin/login` - 관리자 로그인
- `/admin` - 관리자 대시보드 (유저 관리)
- `/admin/recipes` - 게시글 관리
- `/admin/ads` - 광고 관리

## 기술 스택

- React 18
- TypeScript
- Vite
- React Router
- Axios

