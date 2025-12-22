# PRD: Implementation Checklist

**Version**: 1.0
**Date**: 2025-12-21
**Status**: Active
**Related**: [0001-prd-shorts-generator.md](0001-prd-shorts-generator.md)

---

## 1. Overview

Shorts Generator 전체 구현 현황 및 향후 개발 계획을 정리한 실행 체크리스트.

### 프로젝트 진행 상태

```
Phase 1: 인프라        ████████████ 100% ✅
Phase 2: 영상 효과     ████████████ 100% ✅
Phase 3: 고급 기능     ░░░░░░░░░░░░   0% 🔮
Phase 4: AI 자막       ░░░░░░░░░░░░   0% 🔮
Phase 5: TTS 음성      ░░░░░░░░░░░░   0% 🔮
Phase 6: 업로드        ░░░░░░░░░░░░   0% 🔮
```

---

## 2. Phase 1: 인프라 ✅ (완료)

| 상태 | 기능 | 파일 | 설명 |
|:----:|------|------|------|
| ✅ | CLI 구조 | `src/index.js` | Commander.js + Inquirer 대화형 인터페이스 |
| ✅ | Docker 환경 | `Dockerfile` | Node.js 18 + FFmpeg 통합 이미지 |
| ✅ | PocketBase 연동 | `src/api/pocketbase.js` | SDK 인증, 조회, 다운로드 |
| ✅ | 기본 영상 생성 | `src/video/generator.js` | FFmpeg concat demuxer 슬라이드쇼 |
| ✅ | BGM 믹싱 | `src/video/generator.js` | 파일 존재 시 오디오 자동 추가 |

### 완료 기준

- [x] Docker 이미지 빌드 성공
- [x] `docker-compose run --rm shorts-gen list` 동작
- [x] `docker-compose run --rm shorts-gen create --auto` 영상 생성
- [x] `./output/` 디렉토리에 MP4 파일 저장

---

## 3. Phase 2: 영상 효과 ✅ (완료)

| 상태 | 기능 | 파일 | 설명 |
|:----:|------|------|------|
| ✅ | 한글 자막 오버레이 | `src/video/generator.js` | FFmpeg drawtext 필터 (NotoSansKR 폰트) |
| ✅ | 로고 오버레이 | `src/video/generator.js` | FFmpeg overlay 필터 |
| ✅ | Ken Burns 효과 | `src/video/generator.js` | FFmpeg zoompan 필터 (확대/축소 애니메이션) |
| ✅ | 전환 효과 (10종) | `src/video/generator.js` | FFmpeg xfade 필터 |

### 지원 전환 효과

| 효과 | 설명 |
|------|------|
| `fade` | 페이드 인/아웃 |
| `fadeblack` | 검정 화면으로 페이드 |
| `fadewhite` | 흰색 화면으로 페이드 |
| `slideleft` | 왼쪽 슬라이드 |
| `slideright` | 오른쪽 슬라이드 |
| `slideup` | 위로 슬라이드 |
| `slidedown` | 아래로 슬라이드 |
| `wipeleft` | 왼쪽 와이프 |
| `wiperight` | 오른쪽 와이프 |
| `dissolve` | 디졸브 |

### 완료 기준

- [x] 한글 자막 렌더링 정상
- [x] 로고 오버레이 위치 설정 가능
- [x] Ken Burns 효과 적용
- [x] 전환 효과 10종 동작

---

## 4. Phase 3: 고급 기능 🔮 (예정)

| 상태 | 기능 | 파일 | 설명 |
|:----:|------|------|------|
| ❌ | 썸네일 자동 생성 | - | 영상 첫 프레임 또는 대표 이미지 추출 |
| ❌ | 다중 템플릿 지원 | `src/video/templates.js` | 템플릿 프리셋 선택 기능 |
| ❌ | 영상 미리보기 | - | 저해상도 프리뷰 생성 |

### 세부 기능 명세

#### 4.1 썸네일 자동 생성

```bash
# 예상 CLI
docker-compose run --rm shorts-gen create --auto --thumbnail
docker-compose run --rm shorts-gen thumbnail ./output/shorts_2025-12-21.mp4
```

**구현 방안**:
- FFmpeg `-ss 0 -vframes 1` 첫 프레임 추출
- 또는 가장 "좋은" 프레임 선택 알고리즘

#### 4.2 다중 템플릿 지원

```bash
# 예상 CLI
docker-compose run --rm shorts-gen create --template modern
docker-compose run --rm shorts-gen templates list
```

**템플릿 예시**:
| 템플릿 | 설명 |
|--------|------|
| `classic` | 기본 슬라이드쇼 |
| `modern` | 빠른 전환 + 텍스트 애니메이션 |
| `minimal` | 페이드만 사용 |
| `dynamic` | Ken Burns + 다양한 전환 |

#### 4.3 영상 미리보기

```bash
# 예상 CLI
docker-compose run --rm shorts-gen create --auto --preview
# 결과: 480x854 저해상도 빠른 렌더링
```

---

## 5. Phase 4: AI 자막 🔮 (예정)

| 상태 | 기능 | 파일 | 설명 |
|:----:|------|------|------|
| ❌ | 이미지 분석 | `src/ai/vision.js` | Ollama + LLaVA 연동 |
| ❌ | 마케팅 문구 생성 | `src/ai/vision.js` | 사진 기반 자막 자동 생성 |
| ❌ | 자막 스타일 설정 | `config.json` | 폰트, 크기, 색상, 위치 |

### Prerequisites

```bash
# Host에서 Ollama 실행
ollama pull llava
ollama serve
```

### 예상 CLI

```bash
docker-compose run --rm shorts-gen analyze <photo-id>
docker-compose run --rm shorts-gen create --with-caption
docker-compose run --rm shorts-gen create --caption "직접 입력"
```

### config.json 추가 예정

```json
{
  "ai": {
    "ollama": {
      "url": "http://host.docker.internal:11434",
      "model": "llava"
    },
    "captionPrompt": "이 사진을 보고 짧은 마케팅 문구를 생성해주세요."
  }
}
```

---

## 6. Phase 5: TTS 음성 🔮 (예정)

| 상태 | 기능 | 파일 | 설명 |
|:----:|------|------|------|
| ❌ | TTS 생성 | `src/audio/tts.js` | Edge-TTS 한국어 음성 |
| ❌ | 음성 동기화 | `src/audio/tts.js` | 자막 타이밍 맞춤 |
| ❌ | 음성/BGM 밸런스 | `src/video/generator.js` | 볼륨 믹싱 |

### 예상 CLI

```bash
docker-compose run --rm shorts-gen create --with-voice
docker-compose run --rm shorts-gen create --voice "ko-KR-SunHiNeural"
docker-compose run --rm shorts-gen create --voice-rate "+10%"
```

### config.json 추가 예정

```json
{
  "tts": {
    "voice": "ko-KR-SunHiNeural",
    "rate": "+0%",
    "pitch": "+0Hz",
    "volume": 1.0
  }
}
```

---

## 7. Phase 6: 업로드 기능 🔮 (예정)

| 상태 | 기능 | 파일 | 설명 |
|:----:|------|------|------|
| ❌ | YouTube 업로드 | `src/api/youtube.js` | YouTube Data API v3 |
| ❌ | TikTok 업로드 | `src/api/tiktok.js` | 세션 기반 업로드 |
| ❌ | 메타데이터 자동 생성 | - | 제목/설명/태그 |
| ❌ | 예약 업로드 | `src/scheduler/cron.js` | node-cron 스케줄링 |

### 예상 CLI

```bash
docker-compose run --rm shorts-gen upload ./output/shorts_2025-12-21.mp4
docker-compose run --rm shorts-gen upload --youtube
docker-compose run --rm shorts-gen upload --tiktok
docker-compose run --rm shorts-gen upload --all

# 스케줄링
docker-compose run -d shorts-gen schedule --daily "18:00"

# 전체 자동화
docker-compose run --rm shorts-gen auto
```

---

## 8. 기술 스택

| 항목 | 현재 | Phase 3+ |
|------|------|----------|
| Runtime | Node.js 18+ | 동일 |
| Video Engine | FFmpeg (spawn) | 동일 |
| CLI | Commander.js + Inquirer | 동일 |
| Backend | PocketHost.io | 동일 |
| AI Vision | - | Ollama LLaVA |
| TTS | - | Edge-TTS |
| Upload | - | YouTube API, TikTok API |

---

## 9. 파일 구조 (현재 vs 목표)

### 현재 구조

```
src/
├── index.js              # CLI entry
├── api/
│   └── pocketbase.js     # PocketBase SDK
├── video/
│   ├── generator.js      # FFmpeg 영상 생성
│   ├── subtitle.js       # 자막 포맷팅
│   └── templates.js      # 템플릿 프리셋 (미사용)
└── utils/
    └── downloader.js     # 파일 다운로드
```

### 목표 구조

```
src/
├── index.js              # CLI entry
├── api/
│   ├── pocketbase.js     # PocketBase SDK
│   ├── youtube.js        # Phase 6: YouTube API
│   └── tiktok.js         # Phase 6: TikTok API
├── ai/
│   └── vision.js         # Phase 4: Ollama LLaVA
├── audio/
│   ├── bgm.js            # BGM 관리
│   └── tts.js            # Phase 5: Edge-TTS
├── video/
│   ├── generator.js      # FFmpeg 영상 생성
│   ├── subtitle.js       # 자막 포맷팅
│   ├── templates.js      # Phase 3: 템플릿 프리셋
│   └── thumbnail.js      # Phase 3: 썸네일 생성
├── scheduler/
│   └── cron.js           # Phase 6: 스케줄링
└── utils/
    └── downloader.js     # 파일 다운로드
```

---

## 10. 우선순위 로드맵

| 우선순위 | Phase | 기능 | 예상 복잡도 |
|:--------:|-------|------|:-----------:|
| 1 | 3 | 썸네일 자동 생성 | 낮음 |
| 2 | 3 | 영상 미리보기 | 낮음 |
| 3 | 3 | 다중 템플릿 지원 | 중간 |
| 4 | 4 | AI 자막 (Ollama) | 높음 |
| 5 | 5 | TTS 음성 (Edge-TTS) | 중간 |
| 6 | 6 | YouTube 업로드 | 높음 |
| 7 | 6 | TikTok 업로드 | 높음 |
| 8 | 6 | 전체 자동화 (`auto`) | 중간 |

---

## 11. 범례

| 상태 | 의미 |
|:----:|------|
| ✅ | 완료 |
| ⏳ | 진행 중 |
| ❌ | 미구현 |
| 🔮 | 향후 계획 |

---

**Next Steps**: Phase 3 썸네일 자동 생성부터 구현 권장
