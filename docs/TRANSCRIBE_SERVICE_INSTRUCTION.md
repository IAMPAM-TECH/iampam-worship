# 음성파일 텍스트 추출 서비스 구현 Instruction (보완본)

## 개요
음성 설교 파일을 업로드하고 AWS Transcribe를 통해 텍스트로 변환한 후, 편집 및 관리할 수 있는 서비스를 구현합니다.

## 1. 프론트엔드 구현

### 1.1 index.html 수정
- **서비스 카드 추가**: `menu-grid` 섹션에 새로운 서비스 카드 추가
  - **제목**: "음성파일 텍스트추출"
  - **설명**: "음성 설교 파일 업로드 시 설교 텍스트 AI 추출"
  - **아이콘**: 🎤 (마이크 이모지)
  - **링크**: `transcribe.html`
  - **스타일 클래스**: `.transcribe` (기존 서비스 카드 스타일 참고)
  - **키보드 단축키**: Ctrl+5 (기존 단축키 확장)

### 1.2 transcribe.html 생성
- **기본 구조**: `s3explorer.html`의 UI/UX 디자인을 참고하여 구현
- **주요 기능**:
  1. **파일 업로드 영역**
     - 드래그 앤 드롭 지원
     - 파일 선택 버튼
     - 지원 형식: mp3, wav, m4a, flac, mp4 (비디오에서 오디오 추출)
     - 파일 크기 제한: 최대 500MB (AWS Transcribe 제한 고려)
     - 업로드 진행률 표시
  
  2. **파일 목록 표시**
     - 업로드된 음성 파일 목록
     - 각 파일별 상태 표시:
       - ⏳ 대기 중
       - 🔄 변환 중
       - ✅ 완료
       - ❌ 실패
     - 파일명, 업로드 시간, 파일 크기 표시
  
  3. **Transcribe 작업 관리**
     - 작업 시작 버튼
     - 작업 상태 실시간 확인 (폴링 또는 WebSocket)
     - 작업 취소 기능
     - 진행률 표시
  
  4. **텍스트 파일 편집기**
     - 변환된 txt 파일 목록 표시
     - 파일 클릭 시 편집 모달/패널 열기
     - 텍스트 편집 영역 (textarea 또는 에디터)
     - 저장 버튼
     - 취소 버튼
     - 자동 저장 기능 (선택사항)
  
  5. **파일 관리**
     - 음성 파일 삭제
     - txt 파일 삭제
     - 파일 다운로드 (txt 파일)

### 1.3 UI/UX 디자인 참고사항
- `s3explorer.html`의 다음 요소들을 참고:
  - 헤더 디자인 (그라데이션 배경)
  - 파일 그리드/리스트 뷰
  - 모달 다이얼로그 스타일
  - 로딩 오버레이 및 진행률 표시
  - 알림 메시지 시스템
  - 드래그 앤 드롭 영역 스타일

## 2. 백엔드 구현

### 2.1 AWS Transcribe API 엔드포인트 추가

#### 2.1.1 Transcribe 작업 시작
- **엔드포인트**: `POST /api/transcribe/start`
- **요청 본문**:
  ```json
  {
    "audioFilePath": "transcribe/파일명.mp3",
    "languageCode": "ko-KR",
    "outputBucket": "hishalom-data",
    "outputKey": "transcribe/파일명.txt"
  }
  ```
- **기능**:
  - S3에 업로드된 음성 파일 경로를 받아서 Transcribe 작업 시작
  - JobName 생성 (고유한 이름, 예: `transcribe-{timestamp}-{random}`)
  - MediaFileUri는 S3 URI 형식으로 설정
  - OutputBucket과 OutputKey 설정
  - 작업 ID 반환

#### 2.1.2 Transcribe 작업 상태 확인
- **엔드포인트**: `GET /api/transcribe/status/:jobName`
- **기능**:
  - 작업 상태 반환 (IN_PROGRESS, COMPLETED, FAILED)
  - 완료 시 결과 파일 경로 반환
  - 실패 시 에러 메시지 반환

#### 2.1.3 Transcribe 결과 가져오기
- **엔드포인트**: `GET /api/transcribe/result/:jobName`
- **기능**:
  - 완료된 작업의 텍스트 결과를 S3에서 읽어서 반환
  - JSON 형식으로 반환 (전체 텍스트 또는 세그먼트별)

#### 2.1.4 Transcribe 작업 취소
- **엔드포인트**: `DELETE /api/transcribe/:jobName`
- **기능**:
  - 진행 중인 작업 취소

#### 2.1.5 txt 파일 저장 (편집된 내용)
- **엔드포인트**: `PUT /api/transcribe/save-text`
- **요청 본문**:
  ```json
  {
    "filePath": "transcribe/파일명.txt",
    "content": "편집된 텍스트 내용"
  }
  ```
- **기능**:
  - 편집된 텍스트를 S3에 저장

### 2.2 IAM 권한 추가
- **serverless.yml**에 다음 권한 추가:
  ```yaml
  - Effect: Allow
    Action:
      - transcribe:StartTranscriptionJob
      - transcribe:GetTranscriptionJob
      - transcribe:ListTranscriptionJobs
      - transcribe:DeleteTranscriptionJob
    Resource: "*"
  ```

### 2.3 AWS SDK 추가
- **handler.js**에 Transcribe 클라이언트 추가:
  ```javascript
  const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
  const transcribeClient = new TranscribeClient({ region: 'ap-northeast-2' });
  ```

## 3. S3 폴더 구조
```
hishalom-data/
  └── transcribe/
      ├── audio/          # 업로드된 음성 파일
      │   ├── 파일1.mp3
      │   └── 파일2.wav
      └── text/           # 변환된 텍스트 파일 (선택사항)
          ├── 파일1.txt
          └── 파일2.txt
```
또는 단순하게:
```
hishalom-data/
  └── transcribe/
      ├── 파일1.mp3
      ├── 파일1.txt
      ├── 파일2.wav
      └── 파일2.txt
```

## 4. 구현 시 고려사항

### 4.1 비동기 처리
- AWS Transcribe는 비동기 작업이므로:
  - 작업 시작 후 즉시 완료되지 않음
  - 주기적으로 상태 확인 필요 (폴링: 5-10초 간격)
  - 완료 시 사용자에게 알림

### 4.2 에러 처리
- 파일 형식 검증
- 파일 크기 제한 확인
- Transcribe 작업 실패 시 에러 메시지 표시
- 네트워크 오류 처리

### 4.3 사용자 경험
- 업로드 진행률 표시
- Transcribe 작업 진행률 표시
- 로딩 상태 명확히 표시
- 성공/실패 알림 메시지
- 파일 목록 자동 새로고침

### 4.4 성능 최적화
- 대용량 파일 업로드 시 청크 업로드 고려
- 파일 목록 캐싱
- 불필요한 API 호출 최소화

### 4.5 보안
- 파일 업로드 검증 (파일 형식, 크기)
- 경로 조작 방지 (path traversal)
- CORS 설정 확인

## 5. 추가 기능 (선택사항)

### 5.1 언어 자동 감지
- AWS Transcribe의 자동 언어 감지 기능 활용

### 5.2 여러 파일 일괄 처리
- 여러 음성 파일을 한 번에 업로드하고 순차적으로 처리

### 5.3 텍스트 편집 기능 강화
- 구간별 타임스탬프 표시
- 구간별 편집
- 검색 및 교체 기능

### 5.4 내보내기 기능
- Word 문서로 내보내기
- PDF로 내보내기
- 다른 형식으로 내보내기

## 6. 테스트 시나리오

1. **음성 파일 업로드 테스트**
   - 다양한 형식 (mp3, wav, m4a) 업로드
   - 대용량 파일 업로드
   - 잘못된 형식 파일 업로드 시도

2. **Transcribe 작업 테스트**
   - 작업 시작 및 상태 확인
   - 완료된 작업 결과 확인
   - 실패한 작업 처리

3. **텍스트 편집 테스트**
   - 텍스트 파일 열기
   - 편집 및 저장
   - 삭제 기능

4. **에러 처리 테스트**
   - 네트워크 오류
   - 서버 오류
   - 권한 오류

## 7. 구현 순서 권장사항

1. **1단계**: index.html에 서비스 카드 추가
2. **2단계**: transcribe.html 기본 구조 및 UI 구현 (s3explorer.html 참고)
3. **3단계**: 음성 파일 업로드 기능 구현
4. **4단계**: 백엔드 Transcribe API 구현
5. **5단계**: Transcribe 작업 시작 및 상태 확인 기능 구현
6. **6단계**: 텍스트 파일 표시 및 편집 기능 구현
7. **7단계**: 파일 삭제 및 관리 기능 구현
8. **8단계**: 에러 처리 및 사용자 경험 개선
9. **9단계**: 테스트 및 버그 수정

## 8. 참고 자료

- AWS Transcribe 문서: https://docs.aws.amazon.com/transcribe/
- AWS SDK for JavaScript v3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/
- s3explorer.html: UI/UX 참고용

