#!/bin/bash

# ============================================================
# Babple 프로젝트 배포 스크립트
# Docker Compose를 사용한 자동 배포
# ============================================================

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의 (터미널 출력용)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 스크립트 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Babple 프로젝트 배포 시작${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. Docker 및 Docker Compose 설치 확인
echo -e "${YELLOW}[1/6] Docker 설치 확인...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker가 설치되어 있지 않습니다.${NC}"
    echo "설치 명령: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 및 Docker Compose 확인 완료${NC}"

# 2. 환경 변수 파일 확인
echo -e "${YELLOW}[2/6] 환경 변수 파일 확인...${NC}"
if [ ! -f "../backend/.env" ]; then
    echo -e "${YELLOW}⚠ backend/.env 파일이 없습니다.${NC}"
    if [ -f "../env.example" ]; then
        echo "env.example을 복사하여 .env 파일을 생성합니다..."
        cp ../env.example ../backend/.env
        echo -e "${YELLOW}⚠ backend/.env 파일을 수정해주세요!${NC}"
        read -p "계속하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${RED}env.example 파일도 없습니다.${NC}"
        exit 1
    fi
fi

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ docker/.env 파일이 없습니다.${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠ docker/.env 파일을 수정해주세요!${NC}"
        read -p "계속하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

echo -e "${GREEN}✓ 환경 변수 파일 확인 완료${NC}"

# 3. 데이터 디렉토리 생성
echo -e "${YELLOW}[3/6] 데이터 디렉토리 생성...${NC}"
mkdir -p data/postgres
mkdir -p data/uploads
echo -e "${GREEN}✓ 데이터 디렉토리 생성 완료${NC}"

# 4. Docker 이미지 빌드
echo -e "${YELLOW}[4/6] Docker 이미지 빌드...${NC}"
echo "이 작업은 시간이 걸릴 수 있습니다..."
docker compose build --no-cache
echo -e "${GREEN}✓ 이미지 빌드 완료${NC}"

# 5. 서비스 시작
echo -e "${YELLOW}[5/6] 서비스 시작...${NC}"
docker compose up -d
echo -e "${GREEN}✓ 서비스 시작 완료${NC}"

# 6. 서비스 상태 확인
echo -e "${YELLOW}[6/6] 서비스 상태 확인...${NC}"
sleep 5
docker compose ps

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}배포 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "서비스 접속:"
echo "  - Web: http://$(hostname -I | awk '{print $1}')"
echo "  - Backend API: http://$(hostname -I | awk '{print $1}')/api"
echo ""
echo "유용한 명령어:"
echo "  - 로그 확인: docker compose logs -f"
echo "  - 서비스 중지: docker compose down"
echo "  - 서비스 재시작: docker compose restart"
echo "  - 데이터베이스 마이그레이션: docker compose exec backend npm run db:migrate"
echo ""

