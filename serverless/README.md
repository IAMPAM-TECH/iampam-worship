# 하이샬롬 예배자동화 - Serverless Backend

배포 계정: iampam-consulting (831554518661)

aws_access_key_id = AKIA4DHEC72C4WGMRC4P
aws_secret_access_key = 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

AWS Serverless Framework v3를 사용한 하이샬롬 예배자동화 백엔드 서비스입니다.

## 🏗️ 아키텍처

### AWS 서비스 구성

- **AWS Lambda**: 서버리스 컴퓨팅 (Node.js 20.x)
- **API Gateway**: HTTP API 엔드포인트
- **DynamoDB**: NoSQL 데이터베이스 (예배 데이터, 교회 정보)
- **S3**: 파일 스토리지 (이미지, 소스 데이터)
- **CloudFront**: CDN (프론트엔드 배포)
- **Route53**: DNS 관리

### DynamoDB 스키마

#### 테이블: `worship`

**Primary Key 구조:**

- **Partition Key (pk)**: `CHURCH#{교회명}` 또는 `WORSHIP#{교회명}`
- **Sort Key (sk)**: `INFO`, `worship.json`, 또는 날짜 형식 (`YYYY-MM-DD.json`)

**데이터 타입:**

1. **교회 정보**

   ```json
   {
     "pk": "CHURCH#hishalom",
     "sk": "INFO",
     "churchName": "hishalom",
     "adminPassword": "hishalom",
     "createdAt": "2025-01-01T00:00:00.000Z",
     "updatedAt": "2025-01-01T00:00:00.000Z"
   }
   ```

2. **예배 데이터 (worship.json)**

   ```json
   {
     "pk": "WORSHIP#hishalom",
     "sk": "worship.json",
     "folder": "hishalom",
     "data": { "steps": [...] },
     "createdAt": "2025-01-01T00:00:00.000Z",
     "updatedAt": "2025-01-01T00:00:00.000Z"
   }
   ```

3. **날짜별 예배 데이터**

   ```json
   {
     "pk": "WORSHIP#hishalom",
     "sk": "2025-01-01.json",
     "folder": "hishalom",
     "date": "2025-01-01",
     "data": { "steps": [...] },
     "createdAt": "2025-01-01T00:00:00.000Z",
     "updatedAt": "2025-01-01T00:00:00.000Z"
   }
   ```

**Global Secondary Index:**

- **Index Name**: `folder-date-index`
- **Partition Key**: `folder`
- **Sort Key**: `date`

### S3 데이터 구조

- **성경/**: 성경 데이터
  - `성경/{책명}.json`: 각 성경 책의 JSON 파일 (예: `성경/디도서.json`)
  - 각 JSON 파일은 `bookInfo`, `chapters`, `statistics` 구조를 가짐
- **교독/**: 교독 이미지 파일들
  - `교독/{폴더명}/`: 교독 이미지 파일들
- **찬송/**: 찬송 이미지 파일들
  - `찬송/{찬송번호}/`: 찬송 이미지 파일들
- **찬양/**: 찬양 이미지 파일들
  - `찬양/{폴더명}/`: 찬양 이미지 파일들
- **간지/**: 간지 이미지 파일들
  - `간지/{파일명}.png`: 간지 이미지 파일들
- **자료/**: 자료 이미지 파일들
  - `자료/{파일명}.png`: 자료 이미지 파일들
- **찬양반주/**: 찬송가 반주 오디오 파일들
  - `찬양반주/{번호}장-{제목}.mp3`: 찬송가 반주 MP3 파일들 (예: `찬양반주/279장-인 애하 신구 세주 여.mp3`)

### S3 CORS 설정

브라우저에서 S3 오디오 파일에 직접 접근하기 위해 CORS 설정이 필요합니다.

**현재 CORS 설정:**

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

**CORS 설정 확인:**

```bash
aws s3api get-bucket-cors --bucket hishalom-data
```

**CORS 설정 적용:**

```bash
# cors-config.json 파일 생성
cat > cors-config.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

# CORS 설정 적용
aws s3api put-bucket-cors --bucket hishalom-data --cors-configuration file://cors-config.json
```

**설정 설명:**

- **AllowedOrigins**: `*` - 모든 도메인에서 접근 허용
- **AllowedMethods**: `GET`, `HEAD` - 읽기 전용 메서드 허용
- **AllowedHeaders**: `*` - 모든 헤더 허용
- **ExposeHeaders**: `ETag`, `Content-Length`, `Content-Type` - 브라우저에서 접근 가능한 헤더
- **MaxAgeSeconds**: `3000` - CORS preflight 요청 캐시 시간 (약 50분)

## 🚀 설치 및 배포

### 1. 의존성 설치

```bash
cd serverless
npm install
```

### 2. 환경 변수 설정

```bash
cp env.example .env
# .env 파일을 편집하여 AWS 자격 증명 및 설정을 입력
```

### 3. 로컬 개발

```bash
npm run dev
```

### 4. 배포

```bash
# 개발 환경 배포
npm run deploy:dev

# 프로덕션 환경 배포
npm run deploy:prod
```

### Windows PowerShell 배포

```powershell
# PowerShell 실행 정책 설정 (관리자 권한 필요)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 개발 환경 배포
.\deploy.ps1 dev
# 또는
npm run deploy:win:dev

# 프로덕션 환경 배포
.\deploy.ps1 prod
# 또는
npm run deploy:win:prod
```

### 5. 서비스 제거

```bash
npm run remove
```

## 📡 API 엔드포인트

### 교회 관리 API

#### 교회별 로그인

- **POST** `/api/admin-login`
- **Body**: `{ "username": "admin", "password": "비밀번호", "folder": "교회명" }`
- **Response**: `{ "success": true, "message": "로그인 성공", "churchName": "교회명" }`

#### 교회 목록 조회

- **GET** `/api/churches`
- **Response**: `[{ "name": "교회명", "folder": "교회명" }]`

#### 교회 추가

- **POST** `/api/churches`
- **Body**: `{ "churchName": "교회명", "adminPassword": "비밀번호" }`

#### 교회 비밀번호 변경

- **PUT** `/api/churches/:churchName/password`
- **Body**: `{ "newPassword": "새비밀번호" }`

### 예배 데이터 API

#### 예배 데이터 조회

- **GET** `/api/worship?folder=교회명`
- **Response**: `{ "steps": [...] }`

#### 예배 데이터 저장

- **POST** `/api/worship`
- **Body**: `{ "folder": "교회명", "data": { "steps": [...] } }`

#### 날짜별 예배 파일 목록

- **GET** `/api/s3/worship-files?folder=교회명`

#### 날짜별 예배 파일 내용

- **GET** `/api/s3/worship-file-content?folder=교회명&fileName=파일명`

### 소스 데이터 API

#### 소스 데이터 조회

- **GET** `/api/sources/:category` (category: 성경, 교독, 찬송, 찬양, 간지, 자료)

#### 성경 책 목록

- **GET** `/api/bible/books`

#### 성경 구절

- **GET** `/api/bible?book=책명&chapter=장&startVerse=시작절&endVerse=끝절`

### S3 파일 관리 API

#### S3 이미지 프록시

- **GET** `/api/s3-image?path=경로`

#### S3 파일 업로드

- **POST** `/api/s3-upload`
- **Body**: `{ "folderPath": "폴더경로", "fileName": "파일명", "fileData": "base64데이터", "fileType": "파일타입" }`

#### S3 파일 탐색

- **GET** `/api/s3-explorer?path=경로`

#### S3 파일 삭제

- **DELETE** `/api/s3-delete`
- **Body**: `{ "filePath": "파일경로" }`

#### S3 폴더 삭제

- **DELETE** `/api/s3-delete-folder`
- **Body**: `{ "folderPath": "폴더경로" }`

### 헬스체크

- **GET** `/api/health`

## 🔧 주요 변경사항

### Express.js에서 Serverless로 마이그레이션

- **기존**: Express.js 서버 (로컬 실행)
- **현재**: AWS Lambda + API Gateway (서버리스)
- **장점**: 자동 스케일링, 사용량 기반 과금, 높은 가용성

### 데이터베이스 마이그레이션

- **기존**: SQLite (로컬 파일)
- **현재**: DynamoDB (클라우드 NoSQL)
- **장점**: 확장성, 성능, 관리 용이성

### 교회별 인증 시스템

- **기존**: 환경 변수 기반 하드코딩
- **현재**: DynamoDB 기반 동적 관리
- **기능**: 교회 추가/삭제, 비밀번호 변경, API 기반 관리

### 기본 교회 자동 초기화

- **서비스 시작 시**: `hishalom` 교회 자동 생성
- **기본 비밀번호**: `hishalom`
- **확장성**: API를 통한 추가 교회 관리

## 📊 성능 및 확장성 개선

### DynamoDB 최적화

- **GSI 활용**: 날짜별 조회 성능 향상
- **TTL 설정**: 자동 데이터 정리
- **온디맨드 용량**: 비용 최적화

### S3 최적화

- **캐시 무효화**: 브라우저 캐시 제어
- **일관성 보장**: S3 eventual consistency 대응
- **이미지 프록시**: 확장자 자동 처리

### API Gateway 최적화

- **HTTP API**: REST API 대비 비용 절감
- **CORS 설정**: 프론트엔드 통합
- **자동 스케일링**: 트래픽에 따른 자동 확장

## 🔒 보안

### 인증 및 권한

- **AWS IAM**: 세밀한 권한 제어
- **DynamoDB**: 교회별 데이터 격리
- **S3**: 버킷 레벨 보안 정책

### 데이터 보호

- **HTTPS**: 모든 API 통신 암호화
- **환경 변수**: 민감 정보 보호
- **TTL**: 자동 데이터 만료

## 📈 모니터링 및 로깅

### CloudWatch 통합

- **Lambda 로그**: 자동 로그 수집
- **메트릭**: 성능 모니터링
- **알람**: 오류 알림 설정

### 디버깅

- **로컬 개발**: serverless-offline 플러그인
- **배포 로그**: CloudFormation 스택 이벤트
- **API 테스트**: Postman/curl 활용

## 💰 비용 최적화

### DynamoDB

- **온디맨드 용량**: 사용량 기반 과금
- **TTL**: 불필요한 데이터 자동 삭제
- **GSI 최소화**: 필요한 인덱스만 사용

### Lambda

- **메모리 최적화**: 적절한 메모리 할당
- **콜드 스타트**: Provisioned Concurrency 고려
- **타임아웃**: 적절한 실행 시간 설정

### S3

- **스토리지 클래스**: 접근 패턴에 따른 최적화
- **라이프사이클**: 자동 데이터 이동
- **압축**: 이미지 최적화

## 🚨 트러블슈팅

### 일반적인 문제

#### DynamoDB 연결 오류

```bash
# IAM 권한 확인
aws dynamodb describe-table --table-name worship

# 환경 변수 확인
echo $AWS_REGION
echo $AWS_ACCESS_KEY_ID
```

#### S3 접근 오류

```bash
# 버킷 권한 확인
aws s3 ls s3://hishalom-data/

# CORS 설정 확인
aws s3api get-bucket-cors --bucket hishalom-data

# CORS 설정이 없는 경우 (NoSuchCORSConfiguration 오류)
# 위의 "S3 CORS 설정" 섹션을 참고하여 CORS 설정을 적용하세요
```

**오디오 파일 재생 오류 시:**

- CORS 설정이 올바르게 적용되었는지 확인
- 브라우저 콘솔에서 CORS 관련 오류 메시지 확인
- 파일 경로 인코딩 확인 (한글 파일명의 경우 URL 인코딩 필요)

#### API Gateway 오류

```bash
# 로그 확인
serverless logs -f api

# 배포 상태 확인
serverless info
```

### 로컬 개발 문제

#### serverless-offline 오류

```bash
# 포트 충돌 확인
netstat -an | grep 3000

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

## 🔄 배포 워크플로우

### 개발 환경

1. 코드 수정
2. 로컬 테스트 (`npm run dev`)
3. 개발 배포 (`npm run deploy:dev`)
4. 테스트 및 검증

### 프로덕션 환경

1. 개발 환경 검증 완료
2. 프로덕션 배포 (`npm run deploy:prod`)
3. 모니터링 및 알람 설정
4. 백업 및 복구 계획 수립

## 📚 추가 리소스

- [Serverless Framework 문서](https://www.serverless.com/framework/docs/)
- [AWS Lambda 문서](https://docs.aws.amazon.com/lambda/)
- [DynamoDB 문서](https://docs.aws.amazon.com/dynamodb/)
- [API Gateway 문서](https://docs.aws.amazon.com/apigateway/)

---

**버전**: 1.1.0
**최종 업데이트**: 2025.1.25
**작성자**: 김완중집사
