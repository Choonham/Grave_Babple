# ============================================================
# Babple Web Frontend Dockerfile
# React + Vite 웹 프론트엔드를 위한 Docker 이미지
# ============================================================

# Build Stage (빌드 단계)
# React 애플리케이션을 빌드하여 정적 파일 생성
FROM node:22-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사
# package.json과 package-lock.json을 먼저 복사 (레이어 캐싱 최적화)
COPY package*.json ./

# 모든 의존성 설치 (빌드에 개발 의존성도 필요)
RUN npm ci

# 빌드 인자 정의 (환경 변수 전달용)
ARG VITE_API_BASE_URL=http://choonhost.zapto.org

# 환경 변수로 설정 (Vite 빌드 시 사용)
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 소스 코드 복사
# React 컴포넌트 및 설정 파일 복사
COPY . .

# Vite를 사용하여 프로덕션 빌드
# TypeScript 컴파일 + 번들링 + 최적화
# 빌드 결과물은 dist/ 디렉토리에 생성됨 (HTML, CSS, JS)
RUN npm run build

# ============================================================
# Production Stage (프로덕션 단계)
# 빌드된 정적 파일을 Nginx로 서빙
# ============================================================

# 경량 Alpine Linux 기반 Nginx 이미지 사용
FROM nginx:alpine

# 빌드된 정적 파일 복사
# builder 스테이지에서 생성된 dist/ 디렉토리의 모든 파일을
# Nginx의 기본 웹 루트 디렉토리(/usr/share/nginx/html)로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx 설정 파일 복사 (선택사항)
# 커스텀 Nginx 설정이 필요한 경우 주석 해제
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
# Nginx가 80 포트(HTTP)에서 통신할 수 있음을 선언
EXPOSE 80

# 헬스 체크 설정
# Nginx가 정상적으로 서빙하는지 확인
# wget으로 루트 경로에 요청을 보내서 확인
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Nginx 실행
# -g "daemon off": Nginx를 포그라운드로 실행 (컨테이너가 계속 실행되도록)
# 기본적으로 Nginx는 백그라운드로 실행되는데, 컨테이너는 포그라운드 프로세스가 필요함
CMD ["nginx", "-g", "daemon off;"]

