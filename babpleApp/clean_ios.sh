#!/bin/bash

# 에러 발생 시 스크립트 즉시 중단 (안전장치)
set -e

echo "🚀 iOS 빌드 환경 클린 작업을 시작합니다..."

# ios 폴더가 있는지 확인 (엉뚱한 곳에서 삭제 방지)
if [ ! -d "ios" ]; then
  echo "❌ Error: 'ios' 폴더를 찾을 수 없습니다. React Native 프로젝트 루트에서 실행해 주세요."
  exit 1
fi

# 1. ios 폴더로 이동
cd ios

# 2. 기존 데이터 삭제
echo "🗑️  기존 Pods, Lock 파일, DerivedData 삭제 중..."
rm -rf Pods
rm -f Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData

# 3. 팟 재설치
echo "📦 Pod install 실행 중 (Repo update)..."
pod install --repo-update

# 4. 원래 위치로 복귀
cd ..

echo "✅ 모든 작업이 완료되었습니다!"
echo "👉 이제 'npx react-native run-ios'를 실행해 보세요."
