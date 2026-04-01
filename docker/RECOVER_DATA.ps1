# PostgreSQL 데이터 복구 스크립트
# 기존 컨테이너(my-postgres-db)에서 데이터를 추출하여 새로운 컨테이너로 복원

Write-Host "=== PostgreSQL 데이터 복구 ===" -ForegroundColor Cyan

# 1. 기존 컨테이너 시작
Write-Host "`n1. 기존 PostgreSQL 컨테이너 시작 중..." -ForegroundColor Yellow
docker start my-postgres-db

# 잠시 대기 (컨테이너 시작 시간 확보)
Start-Sleep -Seconds 5

# 2. 덤프 생성
Write-Host "`n2. 데이터베이스 덤프 생성 중..." -ForegroundColor Yellow
docker exec my-postgres-db pg_dump -U postgres -d postgres -F p -f /tmp/recovery.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 덤프 생성 실패!" -ForegroundColor Red
    exit 1
}

# 3. 덤프 파일 복사
Write-Host "`n3. 덤프 파일을 호스트로 복사 중..." -ForegroundColor Yellow
if (!(Test-Path ".\data")) {
    New-Item -ItemType Directory -Path ".\data"
}
docker cp my-postgres-db:/tmp/recovery.sql .\data\recovery.sql

if (!(Test-Path ".\data\recovery.sql")) {
    Write-Host "❌ 덤프 파일 복사 실패!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 덤프 파일 생성 완료: .\data\recovery.sql" -ForegroundColor Green

# 4. 덤프 파일 크기 확인
$fileSize = (Get-Item ".\data\recovery.sql").Length / 1MB
Write-Host "   파일 크기: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan

# 5. 새로운 Docker Compose PostgreSQL로 복원
Write-Host "`n4. 새로운 PostgreSQL 컨테이너로 데이터 복원 중..." -ForegroundColor Yellow

# 덤프 파일 복사
docker compose cp .\data\recovery.sql postgres:/tmp/recovery.sql

# 데이터베이스 생성 확인
docker compose exec postgres psql -U postgres -c "SELECT 1;" -d postgres

# 복원 실행
Write-Host "   복원 중... (시간이 걸릴 수 있습니다)" -ForegroundColor Cyan
docker compose exec postgres psql -U postgres -d babple_db -f /tmp/recovery.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 데이터 복구 완료!" -ForegroundColor Green
    Write-Host "`n5. 데이터 확인 중..." -ForegroundColor Yellow
    docker compose exec postgres psql -U postgres -d babple_db -c "\dt"
} else {
    Write-Host "`n❌ 데이터 복원 중 오류 발생!" -ForegroundColor Red
    Write-Host "수동으로 복원을 시도하세요:" -ForegroundColor Yellow
    Write-Host "  docker compose cp .\data\recovery.sql postgres:/tmp/recovery.sql"
    Write-Host "  docker compose exec postgres psql -U postgres -d babple_db -f /tmp/recovery.sql"
}

# 6. 기존 컨테이너 중지 (선택사항)
Write-Host "`n기존 컨테이너를 중지하시겠습니까? (y/n)" -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "y" -or $response -eq "Y") {
    docker stop my-postgres-db
    Write-Host "기존 컨테이너 중지 완료" -ForegroundColor Green
}

Write-Host "`n=== 복구 작업 완료 ===" -ForegroundColor Cyan

