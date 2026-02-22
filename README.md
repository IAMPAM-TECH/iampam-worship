# IAMPAM Worship Automation

교회별 예배 기획, 콘텐츠 관리, 프레젠테이션을 위한 통합 시스템입니다.

## ☁️ AWS 계정 정보

- **AWS 계정**: iampam-prod (831554518661)
- Serverless 백엔드와 Frontend가 이 AWS 계정에 배포됩니다.

## 🚀 빠른 배포

### Serverless 배포
```powershell
.\deploy.ps1
```

### Frontend 배포 및 CloudFront Invalidate
```powershell
# 전체 캐시 무효화 (-- 또는 - 접두사 모두 지원)
.\deploy-frontend.ps1 --InvalidateAll
# 또는
.\deploy-frontend.ps1 -InvalidateAll

# 업로드된 파일만 캐시 무효화
.\deploy-frontend.ps1
```

## 🏗️ 프로젝트 구조

```
hishalom-worship/
├── serverless/             # AWS Serverless 백엔드 (v2.2)
├── frontend-serverless/    # Serverless용 프론트엔드 (v2.2)
├── deploy-frontend.ps1     # 프론트엔드 배포 스크립트
└── README.md
```

## 🚀 버전 정보

### **v2.1 (최신) - AWS Serverless 기반**
Last Updated: 2026-02-05 by 김완중 집사

- **백엔드**: AWS Lambda + API Gateway + DynamoDB + S3
- **프론트엔드**: HTML/CSS/JavaScript (frontend-serverless/)
- **주요 기능**:
  - Serverless 아키텍처
  - DynamoDB 기반 교회별 인증
  - S3 기반 콘텐츠 관리
  - API Gateway HTTP API
  - CloudFront CDN을 통한 글로벌 배포

## 🎯 주요 기능

### **예배 프레젠테이션**

- 교회별 로그인 후 예배 순서에 따라 슬라이드 쇼
- 찬송, 성경, 교독, 찬양 등을 자동으로 표시
- 전체화면 모드 지원
- 키보드/마우스/터치 제어

### **예배 기획 관리**

- 교회별 예배 순서 기획 및 관리
- 찬송, 성경, 교독, 찬양 등을 순서대로 구성
- 날짜별 예배 데이터 저장
- DynamoDB 기반 데이터 관리

### **S3 파일 탐색기**

- S3에 저장된 예배 자료 탐색 및 관리
- 파일 업로드, 삭제, 폴더 관리
- 이미지 미리보기 기능
- 드래그 앤 드롭 지원

### **온라인 성경**

- 다양한 성경 버전 지원
- 성경 구절 검색 및 표시
- 예배에서 바로 사용 가능

## 🏛️ 아키텍처 (v1.8)

### **AWS 서비스 구성**

- **AWS Lambda**: 서버리스 컴퓨팅 (Node.js 20.x)
- **API Gateway**: HTTP API 엔드포인트
- **DynamoDB**: NoSQL 데이터베이스 (예배 데이터, 교회 정보)
- **S3**: 파일 스토리지 (이미지, 소스 데이터)
- **CloudFront**: CDN (프론트엔드 배포)
- **Route53**: DNS 관리

### **데이터 구조**

- **DynamoDB**: 교회별 인증 정보, 예배 데이터
- **S3**: 성경, 교독, 찬송, 찬양, 간지, 자료 이미지
- **API Gateway**: RESTful API 엔드포인트

### **보안 및 인증**

- 교회별 독립적인 로그인 시스템
- DynamoDB 기반 사용자 인증
- CORS 설정을 통한 보안 강화
- HTTPS 통신 강제

## 🚀 수행 절차 / 배포 방법

### 필수 준비
- Serverless CLI 설치: `npm install -g serverless`

### 백엔드 배포
- PowerShell: `.\deploy.ps1` (루트에서 실행)
- 또는 Serverless CLI 직접 배포: `cd serverless && npx serverless deploy --stage dev|prod`

### 프론트엔드 배포
- 기본 배포: `.\deploy-frontend.ps1`
- 전체 캐시 무효화 포함 배포: `.\deploy-frontend.ps1 -InvalidateAll`

### **v1.8 Serverless 배포**  <!-- 기존 절차 참고용 -->

#### **Backend 배포 (deploy.ps1)**

```powershell
# Windows PowerShell에서 실행
cd serverless
.\deploy.ps1

# 또는 npm 스크립트 사용
npm run deploy:win:prod
```

**deploy.ps1 옵션:**

- 기본적으로 production 환경으로 배포
- AWS Lambda + API Gateway + DynamoDB 자동 배포
- 환경 변수 및 IAM 역할 자동 설정

#### **Frontend 배포 (deploy-frontend.ps1)**

```powershell
# Windows PowerShell에서 실행
# 기본 배포 (업로드된 파일만 캐시 무효화)
.\deploy-frontend.ps1

# 전체 캐시 무효화와 함께 배포
.\deploy-frontend.ps1 -InvalidateAll
```

**deploy-frontend.ps1 옵션:**

- `-BucketName`: S3 버킷명 (기본값: hishalom-frontend)
- `-Region`: AWS 리전 (기본값: ap-northeast-2)
- `-CloudFrontDistributionId`: CloudFront 배포 ID (기본값: E65Q2X6LAYQBD)
- `-InvalidateAll`: 전체 캐시 무효화 (선택사항)

**배포 과정:**

1. `frontend-serverless/` 폴더의 모든 파일을 S3에 업로드
2. 파일별 적절한 Content-Type 설정
3. CloudFront 캐시 무효화 요청
4. 배포 완료 후 S3 및 CloudFront URL 제공

**브라우저 캐시 무효화:**

배포 후 브라우저에서 캐시된 파일을 새로고침하려면:

- **Windows/Linux**: `Ctrl + F5` 또는 `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`
- **모바일**: 브라우저 앱을 완전히 종료 후 다시 실행

#### **배포 순서**

```powershell
# 1. Backend 배포
cd serverless
.\deploy.ps1

# 2. Frontend 배포 (전체 캐시 무효화 포함)
cd ..
.\deploy-frontend.ps1 -InvalidateAll
```

## 📡 API 엔드포인트 (v1.8)

### **교회 관리 API**

- `POST /api/admin-login` - 교회별 로그인
- `GET /api/churches` - 교회 목록 조회
- `POST /api/churches` - 교회 추가
- `PUT /api/churches/:churchName/password` - 비밀번호 변경

### **예배 데이터 API**

- `GET /api/worship` - 예배 데이터 조회
- `POST /api/worship` - 예배 데이터 저장
- `GET /api/s3/worship-files` - 날짜별 파일 목록
- `GET /api/s3/worship-file-content` - 날짜별 파일 내용

### **소스 데이터 API**

- `GET /api/sources/:category` - 소스 데이터 조회
- `GET /api/bible/books` - 성경 책 목록
- `GET /api/bible` - 성경 구절 조회

### **S3 파일 관리 API**

- `GET /api/s3-image` - S3 이미지 프록시
- `POST /api/s3-upload` - 파일 업로드
- `GET /api/s3-explorer` - 파일 탐색
- `DELETE /api/s3-delete` - 파일 삭제
- `DELETE /api/s3-delete-folder` - 폴더 삭제

## 🔧 개발 환경

### **필수 요구사항**

- Node.js 20.x 이상
- AWS CLI
- Serverless Framework v3
- PowerShell (Windows 배포용)

### **환경 변수**

```bash
# AWS 설정
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# S3 설정
S3_BUCKET_NAME=hishalom-data

# 프론트엔드 URL
FRONTEND_URL=https://worship.iampam.io
```

### **로컬 개발**

```bash
# Serverless 백엔드 로컬 실행
cd serverless
npm run dev

# 프론트엔드 로컬 실행
cd frontend-serverless
# Live Server 또는 정적 파일 서버로 실행
```

## 📊 성능 및 확장성

### **Serverless 장점**

- **자동 스케일링**: 트래픽에 따른 자동 확장
- **비용 최적화**: 사용량 기반 과금
- **고가용성**: AWS 인프라 활용
- **글로벌 배포**: CloudFront CDN

### **성능 최적화**

- **이미지 최적화**: S3 이미지 프록시 사용
- **로딩 최적화**: 비동기 데이터 로딩
- **캐시 전략**: CloudFront CDN 활용
- **데이터베이스**: DynamoDB NoSQL 최적화

### **보안**

- **IAM 역할**: 세밀한 권한 제어
- **HTTPS**: 모든 API 통신 암호화
- **CORS 설정**: 프론트엔드 도메인 제한
- **교회별 격리**: 데이터 접근 제어

## 🎨 UI/UX 특징

### **디자인**

- 모던한 그라디언트 디자인
- 반응형 레이아웃
- 부드러운 애니메이션
- 직관적인 사용자 인터페이스

### **사용성**

- 키보드 단축키 지원
- 터치 디바이스 지원
- 로딩 애니메이션
- 오류 처리 및 알림

### **반응형 지원**

- **데스크톱**: 1920px 이상
- **태블릿**: 768px - 1919px
- **모바일**: 320px - 767px

## 🚨 트러블슈팅

### **일반적인 문제**

1. **CORS 오류**: 프론트엔드 도메인 확인
2. **권한 오류**: IAM 역할 및 정책 확인
3. **타임아웃**: Lambda 함수 타임아웃 설정 확인
4. **캐시 문제**: CloudFront 캐시 무효화 확인

### **디버깅**

```bash
# 로그 확인
cd serverless
npm run logs

# 배포 상태 확인
serverless info

# 로컬 테스트
npm run dev
```

### **배포 문제 해결**

1. **S3 업로드 실패**: AWS CLI 권한 확인
2. **CloudFront 무효화 실패**: 배포 ID 및 경로 확인
3. **Lambda 배포 실패**: 서버리스 설정 파일 확인

## 📚 추가 리소스

- [Serverless Framework 문서](https://www.serverless.com/framework/docs/)
- [AWS Lambda 문서](https://docs.aws.amazon.com/lambda/)
- [DynamoDB 문서](https://docs.aws.amazon.com/dynamodb/)
- [API Gateway 문서](https://docs.aws.amazon.com/apigateway/)
- [CloudFront 문서](https://docs.aws.amazon.com/cloudfront/)

## 📄 라이센스

MIT License

## 👨‍💻 작성자

**김완중 집사**

- **프로젝트**: IAMPAM Worship Automation
- **버전**: 1.8
- **아키텍처**: AWS Serverless (Lambda + API Gateway + DynamoDB + S3)
- **최종 업데이트**: 2025년 9월

---

**프로젝트 홈페이지**: [worship.iampam.io](https://worship.iampam.io)  
**GitHub**: [hishalom-worship](https://github.com/your-username/hishalom-worship)  
**문의**: 김완중 집사
