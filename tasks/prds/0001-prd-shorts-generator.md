# PRD: Shorts Generator

**Version**: 1.1
**Date**: 2025-12-08
**Status**: Draft

---

## 1. Overview

PocketBase 사진 → 마케팅 쇼츠 영상 자동 생성 CLI 도구

### 개발 전략: MVP → 점진적 기능 추가

```
MVP(영상) → BGM → 자막 → 음성 → 업로드
```

각 단계 완료 시 **동작하는 제품** 배포 가능

---

## 2. 실행 환경 (Docker 필수)

### 2.1 Why Docker?

| 문제 | Docker 해결 |
|------|-------------|
| canvas 네이티브 빌드 | 컨테이너에 사전 빌드됨 |
| FFmpeg 설치 | 이미지에 포함 |
| OS별 차이 | 동일 환경 보장 |
| 의존성 충돌 | 격리된 환경 |

### 2.2 Prerequisites

```bash
# 필수
- Docker Desktop
- PocketBase 서버 (localhost:8090)

# 선택
- Ollama (Phase 3, host에서 실행)
```

### 2.3 Docker 명령어

```bash
# 이미지 빌드
docker build -t shorts-generator .

# 기본 실행 (docker-compose)
docker-compose run --rm shorts-gen <command>

# 대화형 모드 (-it 필수)
docker-compose run --rm -it shorts-gen create
```

### 2.4 Volume Mounts

| 호스트 | 컨테이너 | 용도 |
|--------|----------|------|
| `./output` | `/app/output` | 생성된 영상 |
| `./config.json` | `/app/config.json` | 설정 파일 |
| `./assets/bgm` | `/app/assets/bgm` | BGM 파일 |
| `./assets/fonts` | `/app/assets/fonts` | 폰트 파일 |

### 2.5 Network

```yaml
network_mode: host  # PocketBase 접근용
```

---

## 3. MVP - 영상 완성

### 3.1 목표

PocketBase 사진을 1080x1920 쇼츠 영상으로 변환

### 3.2 기능

| 기능 | 설명 |
|------|------|
| 사진 목록 조회 | PocketBase API 연동 |
| 사진 다운로드 | temp/ 디렉토리에 저장 |
| 영상 생성 | Editly + FFmpeg |
| Ken Burns 효과 | 확대/축소 애니메이션 |
| 전환 효과 | 10종 (fade, crossfade 등) |

### 3.3 CLI (Docker)

```bash
# 사진 목록 조회
docker-compose run --rm shorts-gen list
docker-compose run --rm shorts-gen list -n 50

# 영상 생성 (자동)
docker-compose run --rm shorts-gen create --auto

# 영상 생성 (대화형)
docker-compose run --rm -it shorts-gen create

# 설정 확인
docker-compose run --rm shorts-gen config
```

### 3.4 Tech Stack

| 항목 | 기술 |
|------|------|
| Container | Docker (node:18-bullseye) |
| Runtime | Node.js 18+ |
| CLI | Commander.js |
| Video | Editly (FFmpeg) |
| UI | Chalk, Ora, Inquirer |

### 3.5 Output

- `./output/shorts_{timestamp}.mp4`
- 1080x1920, 30fps
- 사진당 3초

### 3.6 완료 기준

- [ ] Docker 이미지 빌드 성공
- [ ] `docker-compose run --rm shorts-gen list` 동작
- [ ] `docker-compose run --rm shorts-gen create --auto` 영상 생성
- [ ] `./output/` 디렉토리에 MP4 파일 저장

---

## 4. Phase 2 - BGM 삽입

### 4.1 목표

영상에 배경음악 추가

### 4.2 기능

| 기능 | 설명 |
|------|------|
| BGM 파일 관리 | assets/bgm/ 디렉토리 |
| BGM 선택 | 대화형 또는 CLI 옵션 |
| 볼륨 조절 | config.json 설정 |
| 루프 재생 | 영상 길이에 맞춰 반복 |

### 4.3 CLI (Docker)

```bash
# BGM 지정
docker-compose run --rm shorts-gen create --bgm /app/assets/bgm/my-bgm.mp3

# 볼륨 조절
docker-compose run --rm shorts-gen create --bgm-volume 0.3

# BGM 없이
docker-compose run --rm shorts-gen create --no-bgm

# 대화형 BGM 선택
docker-compose run --rm -it shorts-gen create
```

### 4.4 config.json 추가

```json
{
  "audio": {
    "bgmVolume": 0.3,
    "defaultBgm": "./assets/bgm/default.mp3"
  }
}
```

### 4.5 완료 기준

- [ ] assets/bgm/ 폴더의 BGM 목록 표시
- [ ] 대화형 BGM 선택 동작
- [ ] `--bgm` 옵션으로 BGM 지정
- [ ] 영상에 BGM 믹싱 완료

---

## 5. Phase 3 - 자막 삽입

### 5.1 목표

AI 이미지 분석 → 마케팅 문구 자동 생성 → 자막 오버레이

### 5.2 기능

| 기능 | 설명 |
|------|------|
| 이미지 분석 | Ollama + LLaVA (host) |
| 문구 생성 | 마케팅 자막 자동 생성 |
| 자막 스타일 | 폰트, 크기, 색상 설정 |
| 자막 위치 | 하단 중앙 (기본) |

### 5.3 Prerequisites

```bash
# Host에서 Ollama 실행 (Docker 외부)
ollama pull llava
ollama serve
```

### 5.4 CLI (Docker)

```bash
# 단일 사진 분석
docker-compose run --rm shorts-gen analyze <photo-id>

# AI 자막 포함 영상 생성
docker-compose run --rm shorts-gen create --with-caption

# 수동 자막 입력
docker-compose run --rm shorts-gen create --caption "직접 입력"
```

### 5.5 config.json 추가

```json
{
  "ai": {
    "ollama": {
      "url": "http://host.docker.internal:11434",
      "model": "llava"
    },
    "captionPrompt": "이 휠 복원 사진을 보고 짧은 마케팅 문구를 생성해주세요."
  },
  "subtitle": {
    "font": "./assets/fonts/NotoSansKR-Bold.otf",
    "fontSize": 60,
    "textColor": "#FFFFFF",
    "position": "bottom"
  }
}
```

### 5.6 완료 기준

- [ ] Host Ollama 연동 테스트
- [ ] 사진 분석 → 문구 생성 동작
- [ ] 자막 오버레이 영상 생성
- [ ] 한글 폰트 렌더링 정상

---

## 6. Phase 4 - 음성 삽입

### 6.1 목표

자막 → TTS 음성 변환 → 영상에 나레이션 추가

### 6.2 기능

| 기능 | 설명 |
|------|------|
| TTS 생성 | Edge-TTS (한국어) |
| 음성 동기화 | 자막 타이밍에 맞춰 음성 |
| 음성 볼륨 | BGM과 밸런스 조절 |
| 음성 선택 | 다양한 한국어 보이스 |

### 6.3 CLI (Docker)

```bash
# 음성 포함
docker-compose run --rm shorts-gen create --with-voice

# 보이스 선택
docker-compose run --rm shorts-gen create --voice "ko-KR-SunHiNeural"

# 속도 조절
docker-compose run --rm shorts-gen create --voice-rate "+10%"

# 전체 옵션
docker-compose run --rm shorts-gen create --with-caption --with-voice --bgm /app/assets/bgm/upbeat.mp3
```

### 6.4 config.json 추가

```json
{
  "tts": {
    "voice": "ko-KR-SunHiNeural",
    "rate": "+0%",
    "pitch": "+0Hz",
    "volume": 1.0
  },
  "audio": {
    "bgmVolume": 0.2,
    "voiceVolume": 1.0
  }
}
```

### 6.5 완료 기준

- [ ] Edge-TTS 연동 테스트
- [ ] 자막 텍스트 → 음성 파일 생성
- [ ] 음성 + BGM 믹싱
- [ ] 음성 타이밍 자막과 동기화

---

## 7. Phase 5 - 업로드 기능

### 7.1 목표

생성된 영상을 YouTube/TikTok에 자동 업로드

### 7.2 기능

| 기능 | 설명 |
|------|------|
| YouTube 업로드 | YouTube Data API v3 |
| TikTok 업로드 | 세션 기반 업로드 |
| 메타데이터 생성 | 제목/설명/태그 자동 |
| 예약 업로드 | node-cron 스케줄링 |

### 7.3 CLI (Docker)

```bash
# 업로드
docker-compose run --rm shorts-gen upload ./output/shorts_2025-12-08.mp4
docker-compose run --rm shorts-gen upload --youtube
docker-compose run --rm shorts-gen upload --tiktok
docker-compose run --rm shorts-gen upload --all

# 스케줄링 (데몬 모드)
docker-compose run -d shorts-gen schedule --daily "18:00"
docker-compose run --rm shorts-gen schedule --list

# 전체 자동화
docker-compose run --rm shorts-gen auto
```

### 7.4 Volume 추가 (인증 정보)

```yaml
volumes:
  - ./credentials:/app/credentials:ro  # YouTube OAuth
  - ./cookies:/app/cookies             # TikTok session
```

### 7.5 config.json 추가

```json
{
  "youtube": {
    "enabled": true,
    "credentialsPath": "./credentials/youtube.json",
    "categoryId": "2",
    "privacyStatus": "public",
    "defaultTags": ["휠복원", "자동차"]
  },
  "tiktok": {
    "enabled": true,
    "cookiesPath": "./cookies/tiktok.json",
    "defaultHashtags": ["휠복원", "자동차"]
  },
  "scheduler": {
    "timezone": "Asia/Seoul",
    "defaultTime": "18:00"
  }
}
```

### 7.6 완료 기준

- [ ] YouTube OAuth2 인증 플로우
- [ ] YouTube 영상 업로드 성공
- [ ] TikTok 업로드 성공
- [ ] `shorts-gen auto` 전체 파이프라인 동작

---

## 8. Architecture

### 8.1 Docker Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Host Machine                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ PocketBase  │  │   Ollama    │  │   Docker    │     │
│  │  :8090      │  │   :11434    │  │   Desktop   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │              shorts-generator container            │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐           │ │
│  │  │ Node.js │  │ FFmpeg  │  │ Canvas  │           │ │
│  │  │ Editly  │  │         │  │   GL    │           │ │
│  │  └─────────┘  └─────────┘  └─────────┘           │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │                  Host Volumes                      │ │
│  │  ./output/  ./config.json  ./assets/              │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Module Structure

```
src/
├── index.js              # CLI entry
├── api/
│   ├── pocketbase.js     # MVP: PocketBase API
│   ├── youtube.js        # Phase 5: YouTube API
│   └── tiktok.js         # Phase 5: TikTok API
├── ai/
│   └── vision.js         # Phase 3: Ollama LLaVA
├── audio/
│   ├── bgm.js            # Phase 2: BGM 관리
│   └── tts.js            # Phase 4: Edge-TTS
├── video/
│   ├── generator.js      # MVP: Editly 영상 생성
│   ├── subtitle.js       # Phase 3: 자막 처리
│   └── templates.js      # MVP: 영상 템플릿
├── scheduler/
│   └── cron.js           # Phase 5: 스케줄링
└── utils/
    └── downloader.js     # MVP: 파일 다운로드
```

### 8.3 Data Flow (최종)

```
PocketBase ─┬─▶ Ollama (분석) ─▶ 자막 생성
(host)      │   (host)              │
            │                       ▼
            │                  Edge-TTS ─▶ 음성 생성
            │                  (container)    │
            ▼                       ▼         │
         사진 ─────────────────▶ Editly ◀─────┘
         (download)            (container)
                                   │
                                   ▼
                                 MP4
                              (./output/)
                                   │
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
               ./output/       YouTube         TikTok
               (host)          (API)           (API)
```

---

## 9. 현재 상태

| Phase | 기능 | 상태 | 비고 |
|-------|------|------|------|
| MVP | 영상 완성 | ⏳ 테스트 필요 | Docker 빌드 후 검증 |
| 2 | BGM 삽입 | ⏳ 테스트 필요 | 코드 존재, 검증 필요 |
| 3 | 자막 삽입 | ⏳ 대기 | Ollama 연동 필요 |
| 4 | 음성 삽입 | ⏳ 대기 | Edge-TTS 추가 필요 |
| 5 | 업로드 기능 | ⏳ 대기 | API 연동 필요 |

---

## 10. Next Steps

**다음 작업: MVP 검증**

```bash
# 1. Docker 이미지 빌드
docker build -t shorts-generator .

# 2. 사진 목록 테스트
docker-compose run --rm shorts-gen list

# 3. 영상 생성 테스트
docker-compose run --rm shorts-gen create --auto

# 4. 결과 확인
ls -la ./output/
```
