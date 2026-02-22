#!/bin/bash

# 스테이지 선택 (기본값: dev)
STAGE=${1:-dev}

echo "🚀 하이샬롬 예배자동화 Serverless Backend 배포 시작"
echo "📋 스테이지: $STAGE"

# Node.js 버전 확인 (20.x 필요)
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ 오류: Node.js 20.x 이상이 필요합니다. 현재 버전: $(node --version)"
    echo "💡 Node.js를 업그레이드하거나 nvm을 사용하여 버전을 변경하세요."
    exit 1
fi

echo "✅ Node.js 버전 확인 완료: $(node --version)"

# 의존성 설치
echo "📦 의존성 설치 중..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 의존성 설치 실패"
    exit 1
fi

# AWS 자격 증명 확인
echo "🔐 AWS 자격 증명 확인 중..."
aws sts get-caller-identity > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ AWS 자격 증명이 설정되지 않았습니다."
    echo "💡 다음 명령어로 AWS 자격 증명을 설정하세요:"
    echo "   aws configure"
    exit 1
fi

echo "✅ AWS 자격 증명 확인 완료"

# 배포 실행
echo "🚀 Serverless 배포 시작..."
if [ "$STAGE" = "prod" ]; then
    echo "⚠️  프로덕션 환경 배포를 진행합니다."
    read -p "계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 배포가 취소되었습니다."
        exit 1
    fi
fi

serverless deploy --stage $STAGE

if [ $? -eq 0 ]; then
    echo "✅ 배포 완료!"
    echo "🌐 API Gateway URL:"
    serverless info --stage $STAGE | grep "endpoints:" -A 1
else
    echo "❌ 배포 실패"
    exit 1
fi 