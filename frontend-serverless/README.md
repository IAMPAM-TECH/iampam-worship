# 하이샬롬 예배자동화 - Serverless 프론트엔드

AWS Serverless 백엔드와 연동되는 프론트엔드 애플리케이션입니다.

## 🎯 개요

이 폴더는 AWS Serverless 백엔드 (Lambda + API Gateway + DynamoDB + S3)와 연동되는 프론트엔드 코드를 포함합니다.

## 📁 파일 구조

```
frontend-serverless/
├── index.html          # 메인 엔트리 페이지
├── admin.html          # 예배 기획 관리 (교회별 로그인)
├── worship.html        # 예배 프레젠테이션 (교회별 로그인)
├── s3explorer.html     # S3 파일 탐색기
└── README.md
```

## 🚀 주요 기능

### **메인 엔트리 페이지 (index.html)**

- 직관적인 카드형 메뉴 디자인
- Serverless 아키텍처 표시
- API Gateway URL 정보 표시
- 반응형 디자인

### **예배 기획 관리 (admin.html)**

- DynamoDB 기반 교회별 로그인
- 예배 순서 기획 및 관리
- 찬송, 성경, 교독, 찬양 등 구성
- 날짜별 예배 데이터 저장

### **예배 프레젠테이션 (worship.html)**

- 교회별 로그인 후 슬라이드 쇼
- 전체화면 모드 지원
- 키보드/마우스/터치 제어

### **S3 파일 탐색기 (s3explorer.html)**

- S3 파일/폴더 탐색
- 드래그 앤 드롭 업로드
- 파일/폴더 삭제
- 이미지 미리보기

## 🔗 API 연동

### **API Gateway URL**

```
https://yl8j0hj690.execute-api.ap-northeast-2.amazonaws.com
```

### **주요 API 엔드포인트**

- `POST /api/admin-login` - 교회별 로그인
- `GET /api/worship` - 예배 데이터 조회
- `POST /api/worship` - 예배 데이터 저장
- `GET /api/sources/:category` - 소스 데이터 조회
- `GET /api/s3-explorer` - S3 파일 탐색
- `POST /api/s3-upload` - 파일 업로드
- `DELETE /api/s3-delete` - 파일 삭제

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

## 🔧 기술 스택

- **HTML5**: 시맨틱 마크업
- **CSS3**: Flexbox, Grid, 애니메이션
- **JavaScript (ES6+)**: 모듈화, 비동기 처리
- **Fetch API**: HTTP 요청
- **Local Storage**: 세션 관리

## 🚀 배포 방법

### **자동 배포 (권장)**

프로젝트 루트의 `deploy-frontend.ps1` 스크립트를 사용하여 자동으로 S3 업로드 및 CloudFront 캐시 무효화를 수행할 수 있습니다.

```powershell
# 기본 배포 (변경된 파일만 캐시 무효화)
.\deploy-frontend.ps1

# 전체 캐시 무효화
.\deploy-frontend.ps1 -InvalidateAll

# 다른 버킷이나 리전 사용
.\deploy-frontend.ps1 -BucketName "my-bucket" -Region "us-east-1"
```

### **수동 배포**

1. **S3 버킷 생성 및 설정**

   ```bash
   # serverless.yml에 정의된 FrontendBucket 리소스 사용
   cd serverless
   serverless deploy
   ```

2. **프론트엔드 파일 업로드**

   ```bash
   # AWS CLI 사용
   aws s3 sync frontend-serverless/ s3://hishalom-frontend/ --delete
   ```

3. **CloudFront 캐시 무효화**
   ```bash
   aws cloudfront create-invalidation --distribution-id E65Q2X6LAYQBD --paths "/*"
   ```

### **CORS 설정 확인**

배포 후 CORS 오류가 발생하는 경우:

1. S3 버킷의 CORS 설정 확인
2. API Gateway의 CORS 헤더 확인
3. CloudFront 배포의 캐시 무효화 확인

### **로컬 개발**

```bash
# Live Server 사용
cd frontend-serverless
# VS Code Live Server 확장 또는 다른 정적 파일 서버 사용
```

## 🔐 보안

### **CORS 설정**

- API Gateway에서 프론트엔드 도메인 허용
- HTTPS 통신 강제

### **인증**

- DynamoDB 기반 교회별 인증
- 세션 관리

## 📱 반응형 지원

### **디바이스 지원**

- 데스크톱 (1920px 이상)
- 태블릿 (768px - 1919px)
- 모바일 (320px - 767px)

### **브라우저 지원**

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🎯 성능 최적화

### **이미지 최적화**

- S3 이미지 프록시 사용
- 적절한 이미지 포맷 (PNG, JPEG)
- 이미지 압축

### **로딩 최적화**

- 비동기 데이터 로딩
- 로딩 스피너
- 에러 처리

## 🚨 트러블슈팅

### **일반적인 문제**

1. **CORS 오류**: API Gateway CORS 설정 확인
2. **인증 실패**: DynamoDB 교회 정보 확인
3. **파일 업로드 실패**: S3 권한 확인

### **디버깅**

- 브라우저 개발자 도구 사용
- 네트워크 탭에서 API 요청 확인
- 콘솔 로그 확인

## 📄 라이센스

MIT License

## 👨‍💻 작성자

김완중집사

---

**버전**: 1.3  
**최종 업데이트**: 2025.8.1  
**백엔드**: AWS Serverless (Lambda + API Gateway + DynamoDB + S3)
