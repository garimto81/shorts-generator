# 사진 정렬 로직 설계

> **Issue**: #15 | **Status**: Draft | **Created**: 2025-12-30

## 개요

PocketBase에서 조회된 사진을 원본 촬영/저장 순서대로 정렬하여 영상 생성 시 자연스러운 시퀀스를 보장합니다.

---

## 문제 정의

### 현재 상태

```
DB 저장 순서 (랜덤):
_08, _09, _05, _06, _07, _02, _03, _04, (없음), _01

사용자 기대 순서:
_01, _02, _03, _04, _05, _06, _07, _08, _09
```

### 원인

- PocketBase API는 기본적으로 `id` 순서로 반환
- 업로드 순서와 원본 파일 순서가 불일치
- `created` 필드 정렬이 PocketHost에서 지원되지 않음 (#14)

---

## 파일명 패턴 분석

실제 DB 데이터 기반 분석 결과:

| 소스 | 파일명 패턴 | 정렬 키 위치 | 예시 |
|------|-------------|--------------|------|
| **카카오톡** | `kakao_talk_YYYYMMDD_HHMMSSMMM_XX_hash.jpg` | `_XX_` (2자리) | `kakao_talk_20251229_184022484_01_6wa37nkaqv.jpg` |
| **iPhone 카메라** | `img_NNNN_hash.jpg` | `NNNN` (4자리) | `img_4235_0jli6sszed.jpg` |
| **앱 촬영** | `photo_hash.jpg` | 없음 | `photo_gbb7wik8im.jpg` |

### 정규식 패턴

```javascript
// 카카오톡: _01_, _02_, ... _99_
/kakao_talk_\d+_\d+_(\d{2})_/i

// iPhone IMG: img_0001, img_4235
/img_(\d+)_/i

// 날짜 기반: 20251229_184022
/(\d{8}_\d{6})/
```

---

## 설계

### 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   PocketBase    │────▶│  fetchPhotos()   │────▶│   sortPhotos()  │
│   API 응답      │     │  (pocketbase.js) │     │   (sorter.js)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  정렬된 사진    │
                                                 │  배열 반환      │
                                                 └─────────────────┘
```

### 모듈 구조

```
src/
├── utils/
│   └── photo-sorter.js    # 정렬 로직 (신규)
├── api/
│   └── pocketbase.js      # API 호출 후 정렬 적용
└── index.js               # --sort CLI 옵션
```

### 핵심 함수

#### 1. extractSortKey(filename)

파일명에서 정렬 키를 추출합니다.

```javascript
/**
 * 파일명에서 정렬 키 추출
 * @param {string} filename - 파일명
 * @returns {number|string} - 정렬 키 (숫자 우선, 없으면 문자열)
 */
function extractSortKey(filename) {
  if (!filename) return Infinity;

  // 1. 카카오톡 패턴: kakao_talk_YYYYMMDD_HHMMSSMMM_XX_*.jpg
  const kakaoMatch = filename.match(/kakao_talk_\d+_\d+_(\d{2})_/i);
  if (kakaoMatch) {
    return parseInt(kakaoMatch[1], 10);
  }

  // 2. IMG 패턴: img_NNNN_*.jpg
  const imgMatch = filename.match(/img_(\d+)_/i);
  if (imgMatch) {
    return parseInt(imgMatch[1], 10);
  }

  // 3. 일반 숫자 패턴: 파일명 내 첫 번째 연속 숫자
  const numMatch = filename.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  // 4. Fallback: 파일명 알파벳순
  return filename.toLowerCase();
}
```

#### 2. sortPhotos(photos, sortBy)

사진 배열을 정렬합니다.

```javascript
/**
 * 사진 배열 정렬
 * @param {Array} photos - 사진 객체 배열
 * @param {string} sortBy - 정렬 기준 (filename|created|none)
 * @returns {Array} - 정렬된 배열
 */
function sortPhotos(photos, sortBy = 'filename') {
  if (sortBy === 'none' || !photos?.length) {
    return photos;
  }

  return [...photos].sort((a, b) => {
    if (sortBy === 'filename') {
      const keyA = extractSortKey(a.image);
      const keyB = extractSortKey(b.image);

      // 숫자 vs 숫자
      if (typeof keyA === 'number' && typeof keyB === 'number') {
        return keyA - keyB;
      }
      // 숫자 vs 문자열 (숫자 우선)
      if (typeof keyA === 'number') return -1;
      if (typeof keyB === 'number') return 1;
      // 문자열 vs 문자열
      return keyA.localeCompare(keyB);
    }

    if (sortBy === 'created') {
      // created 필드가 없을 수 있음 (PocketHost 제한)
      const dateA = a.created || a.updated || '';
      const dateB = b.created || b.updated || '';
      return dateA.localeCompare(dateB);
    }

    return 0;
  });
}
```

### CLI 인터페이스

```bash
# 기본값: 파일명 기반 정렬
node src/index.js create -g <id> --auto

# 명시적 정렬 옵션
node src/index.js create -g <id> --sort filename  # 파일명 기반
node src/index.js create -g <id> --sort created   # 생성 시간순
node src/index.js create -g <id> --sort none      # 정렬 없음

# list 명령어에도 적용
node src/index.js list -g <id> --sort filename
```

### 옵션 정의

| 옵션 | 값 | 설명 |
|------|-----|------|
| `--sort` | `filename` | 파일명에서 순번 추출하여 정렬 (기본값) |
| | `created` | 업로드 시간순 |
| | `none` | 정렬 없음 (API 반환 순서) |

---

## 구현 계획

### Phase 1: 핵심 로직

1. `src/utils/photo-sorter.js` 생성
   - `extractSortKey()` 함수
   - `sortPhotos()` 함수
   - 단위 테스트

### Phase 2: API 통합

2. `src/api/pocketbase.js` 수정
   - `fetchPhotosByGroup()` 반환 전 정렬 적용
   - `fetchPhotos()` 반환 전 정렬 적용

### Phase 3: CLI 옵션

3. `src/index.js` 수정
   - `--sort` 옵션 추가
   - `list`, `create` 명령어에 적용

### Phase 4: 테스트

4. `tests/photo-sorter.test.js` 작성
   - 카카오톡 패턴 테스트
   - IMG 패턴 테스트
   - 혼합 패턴 테스트
   - Edge case 테스트

---

## 테스트 케이스

### 입력 데이터

```javascript
const testPhotos = [
  { image: 'kakao_talk_20251229_184022484_08_nkm1mjmzk5.jpg' },
  { image: 'kakao_talk_20251229_184022484_01_6wa37nkaqv.jpg' },
  { image: 'kakao_talk_20251229_184022484_05_q7jdyr83u1.jpg' },
  { image: 'photo_gbb7wik8im.jpg' },
  { image: 'img_4235_0jli6sszed.jpg' },
];
```

### 기대 결과

```javascript
// sortBy: 'filename'
[
  { image: 'kakao_talk_20251229_184022484_01_6wa37nkaqv.jpg' }, // 01
  { image: 'kakao_talk_20251229_184022484_05_q7jdyr83u1.jpg' }, // 05
  { image: 'kakao_talk_20251229_184022484_08_nkm1mjmzk5.jpg' }, // 08
  { image: 'img_4235_0jli6sszed.jpg' },                         // 4235
  { image: 'photo_gbb7wik8im.jpg' },                            // 문자열
]
```

---

## 참고

- Issue #6: 이미지 정렬 기준 불명확
- Issue #14: PocketHost created 필드 정렬 불가 문제
