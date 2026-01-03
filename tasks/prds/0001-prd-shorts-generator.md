# PRD: Shorts Generator

**Version**: 3.0
**Date**: 2026-01-03
**Status**: Active

---

## 1. Overview

PocketBase 사진 → 마케팅 쇼츠 영상 자동 생성 CLI 도구

### 개발 전략: MVP → 점진적 기능 추가

```
MVP(영상) ✅ → BGM ✅ → 자막 ✅ → 음성 → 업로드
```

각 단계 완료 시 **동작하는 제품** 배포 가능

---

## 2. 실행 환경

### 2.1 Prerequisites

```bash
# 필수
- Node.js 18+
- FFmpeg
- PocketBase 서버 (PocketHost 또는 localhost:8090)

# 선택
- Docker Desktop (컨테이너 실행 시)
- Google API Key (AI 자막 사용 시)
```

### 2.2 환경변수 (.env)

```bash
POCKETBASE_URL=https://union-public.pockethost.io
POCKETBASE_EMAIL=admin@example.com
POCKETBASE_PASSWORD=password
GOOGLE_API_KEY=your-gemini-api-key
```

### 2.3 CLI 명령어

```bash
# 그룹 목록
node src/index.js groups

# 사진 목록
node src/index.js list
node src/index.js list -g <group_id>

# 영상 생성
node src/index.js create --auto
node src/index.js create -g <group_id> --auto
node src/index.js create --auto --ai-subtitle

# 설정/템플릿 확인
node src/index.js config
node src/index.js templates
```

---

## 3. MVP - 영상 완성 ✅

### 3.1 목표

PocketBase 사진을 1080x1920 쇼츠 영상으로 변환

### 3.2 기능

| 기능 | 설명 | 상태 |
|------|------|------|
| 그룹 목록 조회 | photo_groups 컬렉션 | ✅ |
| 사진 목록 조회 | photos 컬렉션 | ✅ |
| 사진 다운로드 | temp/ 디렉토리 | ✅ |
| 영상 생성 | FFmpeg filter_complex | ✅ |
| Ken Burns 효과 | zoompan 필터 | ✅ |
| 전환 효과 | xfade 10종 | ✅ |
| 자막 오버레이 | drawtext 필터 | ✅ |
| 로고 오버레이 | overlay 필터 | ✅ |

### 3.3 템플릿 시스템

| 템플릿 | 특징 |
|--------|------|
| `classic` | 기본값, 균형 잡힌 설정 (3초, fade) |
| `dynamic` | 빠른 전환, 강한 줌 (2초, slideright) |
| `elegant` | 느린 전환, 부드러운 줌 (4초, crossfade) |
| `minimal` | Ken Burns 비활성화 |
| `quick` | TikTok 최적화 (1.5초) |
| `cinematic` | 영화같은 분위기 (5초) |

### 3.4 Output

- `./output/shorts_{timestamp}.mp4`
- 1080x1920, 30fps
- 동적/무작위 재생 시간 지원

---

## 4. Phase 2 - BGM 삽입 ✅

### 4.1 목표

영상에 배경음악 추가

### 4.2 기능

| 기능 | 설명 | 상태 |
|------|------|------|
| BGM 파일 관리 | assets/bgm/ 디렉토리 | ✅ |
| 대화형 BGM 선택 | Inquirer UI | ✅ |
| CLI --bgm 옵션 | 직접 경로 지정 | ✅ |
| 기본 BGM 설정 | config.audio.defaultBgm | ✅ |
| 랜덤 BGM 선택 | config.audio.randomBgm | ✅ |
| 오디오 페이드인 | afade=t=in:st=0:d=0.5 | ✅ |
| 라이선스 문서화 | docs/BGM_LICENSE.md | ✅ |

### 4.3 CLI

```bash
# 랜덤 BGM (기본값)
node src/index.js create --auto

# BGM 직접 지정
node src/index.js create --auto --bgm assets/bgm/03_jim_yosef_link.mp3

# BGM 없이
node src/index.js create --auto --no-bgm
```

### 4.4 config.json

```json
{
  "audio": {
    "bgmVolume": 0.3,
    "defaultBgm": "upbeat_bgm.mp3",
    "randomBgm": true
  }
}
```

### 4.5 BGM 라이선스

| 출처 | 라이선스 | 파일 수 |
|------|----------|---------|
| NCS (NoCopyrightSounds) | CC BY | 10개 |
| 미확인 | 확인 필요 | 1개 |

상세: `docs/BGM_LICENSE.md`

---

## 5. Phase 3 - 자막 삽입 ✅

### 5.1 목표

AI 이미지 분석 → 마케팅 문구 자동 생성 → 자막 오버레이

### 5.2 기능

| 기능 | 설명 | 상태 |
|------|------|------|
| 이미지 분석 | Google Gemini Vision | ✅ |
| 마케팅 문구 생성 | 프롬프트 템플릿 | ✅ |
| 자막 스타일 | 폰트, 크기, 색상 | ✅ |
| 한글 폰트 | NotoSansKR-Bold | ✅ |
| 동적 재생 시간 | 읽기 속도 기반 | ✅ |
| AI 이미지 정렬 | 작업 단계 기반 순서 정렬 | ✅ |
| **자막 디자인 개선** | 스타일 프리셋, 그림자, 테두리 강화 | ⏳ #23 |
| **자막 줄바꿈 개선** | 한글 조사 분리 방지, 의미 단위 줄바꿈 | ⏳ #23 |

### 5.3 CLI

```bash
# AI 자막 활성화
node src/index.js create --auto --ai-subtitle

# 프롬프트 템플릿 지정
node src/index.js create --auto --ai-subtitle --prompt-template wheelRestoration

# 읽기 속도 조정
node src/index.js create --auto --ai-subtitle --reading-speed slow

# AI 정렬 활성화
node src/index.js create --auto --ai-sort

# AI 정렬 + 결과 확인
node src/index.js create --auto --ai-sort --show-phase
```

### 5.4 프롬프트 템플릿

| 템플릿 | 용도 |
|--------|------|
| `default` | 기본 마케팅 문구 |
| `product` | 제품 홍보 |
| `food` | 음식/요리 |
| `wheelRestoration` | 휠 복원 전문 |

### 5.5 config.json

```json
{
  "ai": {
    "enabled": false,
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "promptTemplate": "default",
    "maxRetries": 3,
    "retryDelayMs": 10000
  },
  "dynamicDuration": {
    "enabled": false,
    "readingSpeed": 250,
    "minDuration": 2.0,
    "maxDuration": 6.0
  }
}
```

### 5.6 AI 이미지 정렬 (v3.2)

휠 복원 작업 흐름에 맞게 이미지 순서 자동 정렬

| Phase | 설명 | 순서 |
|-------|------|------|
| overview | 차량 전체 모습 | 1 |
| before | 복원 전 휠 상태 | 2 |
| process | 작업 중 | 3 |
| after | 복원 후 상태 | 4 |

**처리 흐름**:
1. 파일명 기반 기본 정렬
2. 메타데이터 힌트 추출 (파일명/제목 기반)
3. AI가 각 이미지의 작업 단계(phase) 분류
4. Phase 순서대로 자동 재정렬

**v3.2 개선사항**:
- before/after 구분 정확도 향상 (제외 키워드 도입)
- Phase 분류 프롬프트 판단 로직 명확화
- Rate Limit (429) 에러 재시도 로직 (Exponential Backoff)
- 예시 데이터 확대 (wheelRestoration v2.0)

**관련 파일**:
- `src/ai/phase-sorter.js` - Phase 분류 및 정렬
- `src/ai/vision.js` - Gemini Vision API 연동
- `src/ai/prompt-templates.js` - 분류 프롬프트
- `assets/prompts/examples/wheelRestoration.json` - Few-Shot 예시

### 5.7 자막 퀄리티 개선 ⏳ (Issue #23)

자막 시각적 품질 및 가독성 향상

#### 디자인 개선

| 항목 | 현재 | 개선 목표 |
|------|------|----------|
| 테두리 | borderw=3 | borderw=4~5 |
| 그림자 | 비활성화 | 기본 활성화 |
| 스타일 프리셋 | 1종 (기본) | 5종 (bold, elegant, cinematic 등) |
| 폰트 크기 | 60px 고정 | 텍스트 길이 기반 동적 조절 |

#### 줄바꿈 개선

| 항목 | 현재 | 개선 목표 |
|------|------|----------|
| 최대 글자수 | 15자 고정 | 화면 비율 기반 동적 |
| 한글 조사 | 분리됨 | 분리 방지 (-은/는/이/가/을/를) |
| 줄바꿈 기준 | 글자 수 | 의미 단위 (쉼표, 마침표) |
| 최대 줄 수 | 제한 없음 | 3줄 제한 |

**관련 파일**:
- `src/video/subtitle.js` - 자막 포맷팅
- `src/video/generator.js` - FFmpeg drawtext 필터
- `src/video/templates.js` - 자막 스타일 정의

---

## 6. Phase 4 - 음성 삽입 ⏳

### 6.1 목표

자막 → TTS 음성 변환 → 영상에 나레이션 추가

### 6.2 기능 (계획)

| 기능 | 설명 | 상태 |
|------|------|------|
| TTS 생성 | Edge-TTS (한국어) | ⏳ 대기 |
| 음성 동기화 | 자막 타이밍 | ⏳ 대기 |
| 음성 볼륨 | BGM 밸런스 | ⏳ 대기 |

---

## 7. Phase 5 - 업로드 기능 ⏳

### 7.1 목표

생성된 영상을 YouTube/TikTok에 자동 업로드

### 7.2 기능 (계획)

| 기능 | 설명 | 상태 |
|------|------|------|
| YouTube 업로드 | YouTube Data API v3 | ⏳ 대기 |
| TikTok 업로드 | 세션 기반 | ⏳ 대기 |
| 메타데이터 생성 | 제목/설명/태그 | ⏳ 대기 |
| 예약 업로드 | node-cron | ⏳ 대기 |

---

## 8. Architecture

### 8.1 Module Structure

```
src/
├── index.js              # CLI entry (Commander.js)
├── api/
│   └── pocketbase.js     # PocketBase API
├── ai/
│   ├── vision.js         # Gemini Vision API
│   ├── subtitle-generator.js  # 자막 통합
│   ├── prompt-templates.js    # 프롬프트 템플릿
│   └── phase-sorter.js   # AI 이미지 정렬
├── video/
│   ├── generator.js      # FFmpeg filter_complex
│   ├── subtitle.js       # 자막 처리
│   ├── templates.js      # 영상 템플릿
│   ├── preview.js        # 미리보기
│   ├── thumbnail.js      # 썸네일
│   └── duration-calculator.js  # 재생 시간 계산
└── utils/
    └── downloader.js     # 파일 다운로드
```

### 8.2 Data Flow

```
PocketBase ──▶ fetchPhotos() ──▶ downloadImage()
                                       │
                                       ▼
                              Gemini Vision (선택)
                                       │
                                       ▼
                              generateVideo()
                              (FFmpeg filter_complex)
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
               zoompan           drawtext            xfade
             (Ken Burns)          (자막)           (전환효과)
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       ▼
                                    overlay
                                    (로고)
                                       │
                                       ▼
                                  + BGM (afade)
                                       │
                                       ▼
                                ./output/*.mp4
```

---

## 9. 현재 상태

| Phase | 기능 | 상태 | 비고 |
|-------|------|------|------|
| MVP | 영상 완성 | ✅ 완료 | FFmpeg 직접 호출 |
| 2 | BGM 삽입 | ✅ 완료 | 랜덤/기본/페이드인 |
| 3 | 자막 삽입 | ✅ 완료 | Gemini Vision |
| 3.1 | **자막 퀄리티 개선** | ⏳ 진행 중 | Issue #23 |
| 4 | 음성 삽입 | ⏳ 대기 | Edge-TTS 예정 |
| 5 | 업로드 기능 | ⏳ 대기 | YouTube/TikTok |

---

## 10. 관련 프로젝트

| 프로젝트 | 설명 | 경로 |
|----------|------|------|
| **field-uploader** | 모바일 사진 업로드 PWA | `D:\AI\claude01\field-uploader` |

field-uploader에서 업로드한 사진을 shorts-generator에서 영상으로 변환

---

## 11. Changelog

### v3.0 (2026-01-03)
- ✅ AI Phase 분류 정확도 대폭 개선 (v3.2)
  - before/after 구분 정확도 향상 (제외 키워드 도입)
  - Phase 분류 프롬프트 판단 로직 명확화
  - Rate Limit (429) 에러 재시도 로직 추가
- ✅ 예시 데이터 확대 (wheelRestoration v2.0)
  - Phase별 positive 예시 대폭 확대
  - 브랜드별 표현 (벤츠/BMW/포르쉐 등) 추가
  - 전문 용어 사전 추가
- ✅ API 안정성 강화
  - 모델명 gemini-2.0-flash로 변경 (안정 버전)
  - Exponential backoff 재시도 (10초, 20초, 40초)
- ✅ 테스트 확대
  - phase-sorter 테스트 32개 추가
  - 총 테스트 100개 (68개 → 100개)
- ✅ Issue #21, #22 해결 완료

### v2.0 (2025-12-29)
- ✅ BGM 시작 잡음 제거 (afade 필터)
- ✅ 랜덤 BGM 선택 기능
- ✅ 기본 BGM 자동 적용
- ✅ BGM 라이선스 문서화

### v1.1 (2025-12-08)
- ✅ Docker 환경 구성
- ✅ AI 자막 (Gemini Vision)
- ✅ 템플릿 시스템
- ✅ 미리보기/썸네일

### v1.0 (2025-12-01)
- ✅ MVP: 기본 영상 생성
- ✅ Ken Burns 효과
- ✅ 전환 효과 10종
