# 찬송 반주 기능 구현 기획서

## 1. 개요

### 1.1 목적
찬송 유형의 콘텐츠에 반주(배경음악) 기능을 추가하여, 예배 진행 시 자동으로 반주 음악이 재생되도록 구현

### 1.2 범위
- **admin.html**: 찬송 유형 선택 시 반주 체크박스 추가 및 MP3 파일 매칭 로직
- **worship.html**: 반주 체크박스가 활성화된 경우 자동 재생 및 페이지 이동 시 정지 기능
- **데이터 구조**: 반주 플래그 저장 및 전달

---

## 2. 기능 요구사항

### 2.1 MP3 파일 매칭 로직

#### 2.1.1 매칭 규칙
찬송 내용에서 번호와 제목을 추출하여 `찬양반주` 폴더의 MP3 파일과 매칭

**예시:**
- 입력: `069장 온천하만물우러러(통33)/`
- 매칭 파일: `69장-온 천하 만물 우러러.mp3`

- 입력: `452장 내모든소원기도의제목(통505)/`
- 매칭 파일: `452장-내 모든 소원 기도의 제목.mp3`

#### 2.1.2 매칭 알고리즘
1. **번호 추출**: 내용에서 `{숫자}장` 패턴 추출
   - 예: `069장` → `69` (앞의 0 제거)
   - 예: `452장` → `452`

2. **제목 추출**: `{번호}장` 이후의 텍스트에서 제목 추출
   - `(통{숫자})` 패턴 제거
   - 끝의 `/` 제거
   - 공백 정규화 (연속된 공백을 하나로, 단어 사이 공백 추가)

3. **파일명 생성**: `{번호}장-{제목}.mp3` 형식으로 변환
   - 예: `69장-온 천하 만물 우러러.mp3`
   - 예: `452장-내 모든 소원 기도의 제목.mp3`

4. **파일 존재 확인**: S3의 `찬양반주` 폴더에서 해당 파일 존재 여부 확인

#### 2.1.3 정규화 규칙
- **공백 처리**: 
  - 연속된 공백 → 단일 공백
  - 한글 문자 사이 공백 유지 (예: "온천하" → "온 천하")
- **특수문자 제거**: 
  - `(통{숫자})` 패턴 제거
  - 끝의 `/` 제거
- **대소문자**: 파일명은 대소문자 구분 없이 매칭

---

### 2.2 admin.html - 반주 체크박스 추가

#### 2.2.1 UI 요구사항
- **위치**: 유형 선택 콤보박스 위에 배치
- **표시 조건**: 유형이 '찬송'일 때만 표시
- **라벨**: "반주"
- **기본값**: uncheck (false)

#### 2.2.2 데이터 구조
```javascript
{
  Step: 1,
  Type: "찬송",
  Content: "069장 온천하만물우러러(통33)/",
  Accompaniment: false  // 새로 추가되는 필드
}
```

#### 2.2.3 기능
- 체크박스 상태 변경 시 `worshipData.Worship[index].Accompaniment` 업데이트
- 유형이 '찬송'이 아닐 때는 체크박스 숨김 및 값 초기화

---

### 2.3 worship.html - 반주 자동 재생

#### 2.3.1 재생 조건
- 현재 슬라이드의 유형이 '찬송'
- 해당 step의 `Accompaniment` 필드가 `true`
- MP3 파일이 존재하고 매칭 가능한 경우

#### 2.3.2 재생 로직
1. **슬라이드 표시 시** (`showSlide` 함수):
   - 찬송 유형이고 반주가 활성화된 경우
   - MP3 파일 경로 생성 및 로드
   - 3초 후 자동 재생 시작
   - 배경음악으로 재생 (볼륨 조절 가능)

2. **페이지 이동 시**:
   - `nextSlide()`, `previousSlide()`, `nextFile()`, `previousFile()` 호출 시
   - 현재 재생 중인 반주 음악 정지
   - 새 슬라이드가 찬송이고 반주가 활성화된 경우 새 반주 재생

3. **재생 제어**:
   - HTML5 Audio API 사용
   - 반복 재생 옵션 (선택사항)
   - 볼륨 조절 (기본값: 0.5)

---

## 3. 기술 명세

### 3.1 파일 수정 목록

#### 3.1.1 frontend-serverless/admin.html
- **위치**: `renderSteps()` 함수 내
- **수정 내용**:
  1. 찬송 유형일 때 반주 체크박스 추가
  2. `updateStepType()` 함수에서 유형 변경 시 Accompaniment 초기화
  3. 반주 체크박스 변경 핸들러 추가

#### 3.1.2 frontend-serverless/worship.html
- **수정 내용**:
  1. 전역 변수 추가: `currentAccompanimentAudio` (현재 재생 중인 Audio 객체)
  2. `showSlide()` 함수 수정: 반주 재생 로직 추가
  3. `nextSlide()`, `previousSlide()`, `nextFile()`, `previousFile()` 함수 수정: 반주 정지 로직 추가
  4. MP3 파일 매칭 함수 추가: `getAccompanimentFilePath(content)`
  5. 반주 재생 함수 추가: `playAccompaniment(filePath)`
  6. 반주 정지 함수 추가: `stopAccompaniment()`

#### 3.1.3 backend (필요 시)
- **API 엔드포인트**: `GET /s3-audio?path={경로}`
  - S3에서 MP3 파일을 가져오는 엔드포인트
  - 또는 직접 S3 URL 사용 가능

---

### 3.2 데이터 흐름

```
admin.html
  ↓
[찬송 유형 선택]
  ↓
[반주 체크박스 표시]
  ↓
[체크박스 상태 저장]
  ↓
worshipData.Worship[index].Accompaniment = true/false
  ↓
worship.html
  ↓
[슬라이드 표시]
  ↓
[Accompaniment === true 확인]
  ↓
[MP3 파일 경로 생성]
  ↓
[3초 후 자동 재생]
  ↓
[페이지 이동 시 정지]
```

---

## 4. 구현 상세

### 4.1 MP3 파일 매칭 함수

```javascript
/**
 * 찬송 내용에서 MP3 파일 경로 생성
 * @param {string} content - 찬송 내용 (예: "069장 온천하만물우러러(통33)/")
 * @returns {string|null} - MP3 파일 경로 또는 null
 */
function getAccompanimentFilePath(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  // 1. 번호 추출 (예: "069장" → "69")
  const numberMatch = content.match(/(\d+)장/);
  if (!numberMatch) {
    return null;
  }
  const number = parseInt(numberMatch[1], 10).toString(); // 앞의 0 제거

  // 2. 제목 추출
  let title = content
    .replace(/\d+장\s*/, '') // 번호 부분 제거
    .replace(/\(통\d+\)/g, '') // (통{숫자}) 패턴 제거
    .replace(/\/$/, '') // 끝의 / 제거
    .trim();

  // 3. 공백 정규화
  // 한글 문자 사이에 공백이 없으면 추가 (간단한 휴리스틱)
  title = title.replace(/([가-힣])([가-힣])/g, '$1 $2'); // 한글 사이 공백 추가
  title = title.replace(/\s+/g, ' '); // 연속된 공백을 하나로

  // 4. 파일명 생성
  const fileName = `${number}장-${title}.mp3`;
  const filePath = `찬양반주/${fileName}`;

  return filePath;
}
```

### 4.2 반주 재생 함수

```javascript
/**
 * 반주 음악 재생
 * @param {string} filePath - MP3 파일 경로
 */
function playAccompaniment(filePath) {
  // 기존 재생 중인 음악 정지
  stopAccompaniment();

  // Audio 객체 생성
  const audio = new Audio();
  audio.src = `${API_BASE}/s3-audio?path=${encodeURIComponent(filePath)}`;
  audio.volume = 0.5; // 기본 볼륨 50%
  audio.loop = false; // 반복 재생 안 함

  // 3초 후 재생
  setTimeout(() => {
    audio.play().catch(err => {
      console.error('반주 재생 실패:', err);
    });
  }, 3000);

  // 전역 변수에 저장
  currentAccompanimentAudio = audio;
}

/**
 * 반주 음악 정지
 */
function stopAccompaniment() {
  if (currentAccompanimentAudio) {
    currentAccompanimentAudio.pause();
    currentAccompanimentAudio.currentTime = 0;
    currentAccompanimentAudio = null;
  }
}
```

### 4.3 admin.html 수정 예시

```javascript
// renderSteps() 함수 내
<div class="form-group">
  <label>유형</label>
  <select onchange="updateStepType(${index}, this.value)">
    <!-- 옵션들 -->
  </select>
</div>

<!-- 반주 체크박스 추가 (찬송 유형일 때만 표시) -->
${step.Type === "찬송" ? `
  <div class="form-group">
    <label>
      <input 
        type="checkbox" 
        ${step.Accompaniment ? "checked" : ""} 
        onchange="updateStep(${index}, 'Accompaniment', this.checked)"
      >
      반주
    </label>
  </div>
` : ""}

<div class="form-group">
  <label>내용</label>
  <select onchange="updateStep(${index}, 'Content', this.value)">
    <!-- 옵션들 -->
  </select>
</div>
```

### 4.4 worship.html 수정 예시

```javascript
// showSlide() 함수 내
async function showSlide(index) {
  // ... 기존 코드 ...

  // 반주 처리
  if (newSlide.step.Type === "찬송" && newSlide.step.Accompaniment) {
    const content = typeof newSlide.step.Content === 'string' 
      ? newSlide.step.Content 
      : '';
    const accompanimentPath = getAccompanimentFilePath(content);
    if (accompanimentPath) {
      playAccompaniment(accompanimentPath);
    }
  } else {
    // 찬송이 아니거나 반주가 비활성화된 경우 정지
    stopAccompaniment();
  }

  // ... 기존 코드 ...
}

// nextSlide(), previousSlide() 등에서도 반주 정지 로직 추가
async function nextSlide() {
  stopAccompaniment(); // 기존 반주 정지
  // ... 기존 코드 ...
}
```

---

## 5. 테스트 시나리오

### 5.1 admin.html 테스트
1. ✅ 찬송 유형 선택 시 반주 체크박스 표시 확인
2. ✅ 다른 유형 선택 시 반주 체크박스 숨김 확인
3. ✅ 반주 체크박스 기본값이 uncheck인지 확인
4. ✅ 반주 체크박스 상태 변경 시 데이터 저장 확인

### 5.2 MP3 파일 매칭 테스트
1. ✅ `069장 온천하만물우러러(통33)/` → `69장-온 천하 만물 우러러.mp3` 매칭 확인
2. ✅ `452장 내모든소원기도의제목(통505)/` → `452장-내 모든 소원 기도의 제목.mp3` 매칭 확인
3. ✅ 다양한 형식의 찬송 내용에 대한 매칭 정확도 확인

### 5.3 worship.html 테스트
1. ✅ 반주가 활성화된 찬송 슬라이드 표시 시 3초 후 자동 재생 확인
2. ✅ 다음 페이지 이동 시 반주 정지 확인
3. ✅ 이전 페이지 이동 시 반주 정지 확인
4. ✅ 반주가 비활성화된 찬송 슬라이드에서는 재생 안 되는지 확인
5. ✅ 찬송이 아닌 유형의 슬라이드에서는 재생 안 되는지 확인

---

## 6. 주의사항 및 제약사항

### 6.1 주의사항
- **파일명 매칭**: 한글 제목의 공백 처리에 주의 (예: "온천하" → "온 천하")
- **S3 경로**: `찬양반주` 폴더가 S3에 존재하는지 확인 필요
- **오디오 로딩**: 네트워크 지연 시 재생 실패 가능성 고려
- **브라우저 호환성**: HTML5 Audio API 지원 브라우저에서만 동작

### 6.2 제약사항
- MP3 파일이 S3에 존재하지 않으면 재생 불가
- 파일명이 정확히 매칭되지 않으면 재생 불가
- 브라우저 자동재생 정책에 따라 사용자 상호작용 후에만 재생 가능할 수 있음

---

## 7. 향후 개선 사항

1. **볼륨 조절 UI**: 사용자가 반주 볼륨을 조절할 수 있는 슬라이더 추가
2. **반복 재생 옵션**: 반주를 반복 재생할지 여부 선택
3. **재생 상태 표시**: 현재 반주가 재생 중인지 시각적으로 표시
4. **에러 처리**: MP3 파일이 없을 때 사용자에게 알림
5. **캐싱**: 자주 사용되는 MP3 파일 캐싱으로 로딩 속도 개선

---

## 8. 구현 일정 (예상)

1. **1일차**: MP3 파일 매칭 로직 구현 및 테스트
2. **2일차**: admin.html 반주 체크박스 추가
3. **3일차**: worship.html 반주 재생/정지 로직 구현
4. **4일차**: 통합 테스트 및 버그 수정

---

## 9. 참고 자료

- S3 버킷 구조: `S3_BUCKET_ANALYSIS.md`
- HTML5 Audio API: https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement
- 한글 정규화: https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Regular_Expressions
