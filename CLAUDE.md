# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **전역 규칙 적용**: [상위 CLAUDE.md](../CLAUDE.md) 참조

---

## Project Overview

**Shorts Generator** - PocketBase에서 사진을 가져와 마케팅용 쇼츠 영상을 생성하는 CLI 도구

| 항목 | 내용 |
|------|------|
| Runtime | Node.js 18+ (ES Modules) |
| Video Engine | FFmpeg filter_complex (zoompan + xfade) |
| CLI | Commander.js + Inquirer (대화형) |
| Backend | PocketBase (로컬 또는 PocketHost.io) |
| API Client | PocketBase JavaScript SDK v0.26+ |
| AI | Google Gemini API (자막 자동 생성) |

---

## Commands

```bash
# Docker 환경 (권장)
docker-compose up -d pocketbase                   # PocketBase 시작
docker-compose build shorts-gen                   # 최초 빌드
docker-compose run --rm shorts-gen groups         # 그룹 목록 조회
docker-compose run --rm shorts-gen list           # 사진 목록 조회
docker-compose run --rm shorts-gen list -g <id>   # 특정 그룹 사진 조회
docker-compose run --rm shorts-gen create --auto  # 자동 모드 (최신 그룹)
docker-compose run --rm shorts-gen create -g <id> --auto -n 50  # 그룹 전체 사진 사용
docker-compose run --rm -it shorts-gen create     # 대화형 모드 (그룹 선택 → 사진 선택)
docker-compose run --rm shorts-gen config         # 설정/전환효과 목록

# 로컬 개발 (Node.js 18+ / FFmpeg 필수)
npm install
node src/index.js groups                          # 그룹 목록 조회
node src/index.js list -n 10 --group <id>         # 그룹별 사진 조회
node src/index.js create --group <id> --auto -n 50  # 그룹 전체 사진으로 영상 생성
node src/index.js create --ids abc123,def456 --transition fade
node src/index.js create --auto --ai-subtitle     # AI 자막 자동 생성

# PocketBase 초기 설정 (photos, photo_groups 컬렉션)
node scripts/setup-pocketbase.js
```

### CLI 주요 옵션

| 명령어 | 옵션 | 설명 |
|--------|------|------|
| `groups` | `-n, --limit <number>` | 그룹 조회 개수 (기본 20) |
| `groups` | `--since <YYYY-MM-DD>` | 특정 날짜 이후 필터 |
| `list` | `-n, --limit <number>` | 최대 조회 개수 (기본 20) |
| `list` | `-g, --group <id>` | 특정 그룹의 사진만 조회 |
| `list` | `--since <YYYY-MM-DD>` | 특정 날짜 이후 필터 |
| `create` | `--auto` | 자동 모드 (대화형 프롬프트 생략) |
| `create` | `-n, --count <number>` | 사진 개수 (기본 5, **그룹 전체 사용 시 50 권장**) |
| `create` | `-g, --group <id>` | 특정 그룹의 사진으로 영상 생성 |
| `create` | `--ids <id1,id2,...>` | 특정 사진 ID 지정 |
| `create` | `--transition <name>` | 전환 효과 (fade, slideright 등) |
| `create` | `--bgm <path>` | BGM 파일 경로 |
| `create` | `--no-logo` | 로고 비활성화 |
| `create` | `--thumbnail` | 영상 생성 후 썸네일 자동 생성 |
| `create` | `--preview` | 저해상도 미리보기만 생성 (빠른 확인용) |
| `create` | `-t, --template <name>` | 영상 템플릿 (classic, dynamic, elegant 등) |
| `create` | `--ai-subtitle` | AI로 마케팅 자막 자동 생성 (GOOGLE_API_KEY 필요) |
| `create` | `--prompt-template <type>` | AI 프롬프트 템플릿 (default/product/food/wheelRestoration) |
| `create` | `--reading-speed <speed>` | 읽기 속도 (slow/normal/fast 또는 CPM 숫자) |
| `create` | `--beat-sync <bpm>` | BGM 비트 동기화 (slow/medium/upbeat/fast 또는 BPM 숫자) |
| `create` | `--transition-mode <mode>` | 전환 효과 모드 (single/sequential/random) |
| `thumbnail` | `-p, --position <pos>` | 썸네일 추출 위치 (start/middle/end 또는 초) |
| `templates` | `-d, --detail` | 템플릿 상세 정보 표시 |

### 영상 생성 필수 규칙

| 규칙 | 설명 |
|------|------|
| **그룹 전체 사진 사용** | 영상 생성 시 `-n 50` 옵션으로 그룹의 모든 사진 포함 (기본값 5는 테스트용) |
| **그룹 지정 필수** | `-g <id>` 옵션으로 특정 그룹 지정 (혼합 방지) |
| **미리보기 먼저** | `--preview`로 확인 후 본 영상 생성 권장 |

```bash
# 올바른 사용 예시
node src/index.js create -g <group_id> --auto -n 50

# 잘못된 사용 (5장만 사용됨)
node src/index.js create -g <group_id> --auto
```

---

## Architecture

### Data Flow

```
PocketBase → fetchPhotos() → downloadImage() → generateVideo() → MP4
     ↓             ↓              ↓                  ↓
photos 컬렉션   배열 반환     temp/{id}.jpg    FFmpeg filter_complex
```

### 핵심 모듈

| 모듈 | 역할 |
|------|------|
| `src/index.js` | CLI 진입점 (Commander 명령어 정의, Inquirer 대화형 UI) |
| `src/api/pocketbase.js` | PocketBase API (`fetchGroups`, `fetchPhotosByGroup`, `fetchPhotos`, `downloadImage`) |
| `src/video/generator.js` | FFmpeg filter_complex 파이프라인 (Ken Burns + xfade + 자막 + 로고) |
| `src/video/subtitle.js` | `formatSubtitle(text, 15)` - 15자 단위 줄바꿈 |
| `src/video/templates.js` | 8개 템플릿 정의 (classic, dynamic, elegant, minimal, quick, cinematic 등) |
| `src/video/preview.js` | 저해상도 미리보기 생성 (fast/balanced/quality 프리셋) |
| `src/video/thumbnail.js` | 영상에서 썸네일 이미지 추출 |
| `src/video/duration-calculator.js` | 읽기 속도 기반 동적 재생 시간 계산 |
| `src/ai/subtitle-generator.js` | AI 자막 생성 통합 (이미지 분석 → 자막 → 재생 시간) |
| `src/ai/vision.js` | Google Gemini Vision API 연동 (`analyzeImageBatch`) |
| `src/ai/prompt-templates.js` | AI 프롬프트 템플릿 (default, product, food, wheelRestoration) |
| `src/audio/beat-sync.js` | BPM 기반 비트 동기화 (전환 타이밍 계산) |

### FFmpeg 파이프라인 (generator.js)

영상 생성은 단일 FFmpeg 명령어로 처리 (filter_complex 체인):

```
1. zoompan → Ken Burns 효과 (확대/축소 교차)
2. drawtext → 자막 오버레이 (NotoSansKR 폰트)
3. xfade → 클립 간 전환 효과 (10종)
4. overlay → 로고 합성 (우측 상단)
5. 오디오: -shortest로 영상 길이에 맞춤
```

Ken Burns 표현식: `zoom=1.0+(0.15)*on/(duration*fps)` (zoom in/out 교차)

### 템플릿 시스템 (templates.js)

| 템플릿 | 특징 |
|--------|------|
| `classic` | 기본값, 균형 잡힌 설정 (3초, fade) |
| `dynamic` | 빠른 전환, 강한 줌 (2초, slideright) |
| `elegant` | 느린 전환, 부드러운 줌 (4초, crossfade) |
| `minimal` | Ken Burns 비활성화, 깔끔 (3초, fade) |
| `wheelRestoration` | 휠 복원 작업 최적화 (3초, directionalwipe) |
| `beforeAfter` | 전/후 비교용 (4초, wipeleft, 중앙 자막) |
| `quick` | TikTok 최적화 (1.5초, slideleft) |
| `cinematic` | 영화같은 분위기 (5초, fade) |

자막 스타일: `default`, `bold`, `minimal`, `elegant`, `cinematic`, `contrast`, `boxed`, `shadow`, `boxedShadow`

미리보기 품질: `fast` (360x640), `balanced` (540x960), `quality` (720x1280)

### PocketBase 스키마

**photo_groups 컬렉션:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | text | ✓ | 그룹 제목 (제품명 등) |

**photos 컬렉션:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `group` | relation | | photo_groups 참조 |
| `title` | text | ✓ | 사진 제목 (자막으로 사용) |
| `image` | file | ✓ | 원본 이미지 (10MB 이하) |
| `thumbnail` | file | | 썸네일 |

---

## Configuration

**config.json** 구조:

| 섹션 | 키 | 기본값 | 설명 |
|------|-----|--------|------|
| `pocketbase.url` | | `https://union-public.pockethost.io` | PocketBase 서버 URL (PocketHost) |
| `pocketbase.collection` | | `photos` | 컬렉션 이름 |
| `pocketbase.auth` | | `null` | Superuser 인증 (email/password) |
| `video.width/height` | | `1080x1920` | 영상 해상도 (세로 쇼츠) |
| `video.fps` | | `30` | 프레임 레이트 |
| `video.photoDuration` | | `3` | 사진당 표시 시간 (초) |
| `video.transitionDuration` | | `0.5` | 전환 효과 시간 (초) |
| `branding.enabled` | | `true` | 로고 표시 여부 |
| `subtitle.font` | | `./assets/fonts/NotoSansKR-Bold.otf` | 폰트 경로 |
| `output.directory` | | `output` | 영상 출력 디렉토리 |
| `ai.enabled` | | `false` | AI 자막 기본 활성화 |
| `ai.provider` | | `gemini` | AI 제공자 |
| `ai.model` | | `gemini-2.0-flash-exp` | Gemini 모델 |
| `ai.promptTemplate` | | `default` | 기본 프롬프트 템플릿 |
| `dynamicDuration.enabled` | | `false` | 자막 길이 기반 동적 재생 시간 |
| `dynamicDuration.readingSpeed` | | `250` | 읽기 속도 (CPM) |
| `randomDuration.enabled` | | `true` | 무작위 재생 시간 (기본 활성화) |
| `randomDuration.min/max` | | `5/10` | 무작위 범위 (초) |
| `audio.randomBgm` | | `true` | assets/bgm 폴더에서 랜덤 BGM 선택 |
| `audio.defaultBgm` | | `upbeat_bgm.mp3` | 기본 BGM 파일 |

### AI 자막 시스템

```
이미지 → Gemini Vision API → 마케팅 문구 생성 → 재생 시간 계산
                ↓                    ↓                  ↓
      analyzeImageBatch()     promptTemplate 적용   readingSpeed 기반
```

### 환경변수

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

| 환경변수 | 설명 | 필수 |
|----------|------|------|
| `POCKETBASE_URL` | PocketBase 서버 URL | 선택 (config.json 폴백) |
| `POCKETBASE_EMAIL` | Superuser 이메일 | 선택 |
| `POCKETBASE_PASSWORD` | Superuser 비밀번호 | 선택 |
| `GOOGLE_API_KEY` | Gemini API 키 | AI 자막 사용 시 필수 |

API 키 발급: https://aistudio.google.com/apikey

---

## Debugging

```bash
# PocketBase 연결 테스트
curl http://localhost:8090/api/health

# Docker 로그
docker-compose logs shorts-gen
docker-compose logs pocketbase

# FFmpeg 명령어 확인 (generator.js 콘솔 출력)
# 영상 생성 시 전체 FFmpeg 명령어가 표시됨
```

---

## Shared Infrastructure

### PocketBase (공유 스토리지)

형제 프로젝트 **field-uploader**와 **동일한 PocketBase 인스턴스** 사용:

| 환경 | URL | 용도 |
|------|-----|------|
| Production | `https://union-public.pockethost.io` | field-uploader 업로드 + shorts-generator 조회 |
| Local | `http://localhost:8090` | 로컬 개발/테스트 |

```
📱 field-uploader (모바일 PWA)
        ↓ 사진 업로드
☁️ PocketHost (union-public.pockethost.io)
        ↓ 사진 조회
🎬 shorts-generator (영상 생성 CLI)
```

---

## Related Projects

| 프로젝트 | 설명 | 경로 |
|----------|------|------|
| **field-uploader** | 모바일 사진 촬영/업로드 PWA | `D:\AI\claude01\field-uploader` |

### field-uploader 연동

field-uploader에서 업로드된 사진을 자동으로 조회하여 영상 생성:

```bash
# 모바일에서 촬영한 사진 그룹 확인
node src/index.js groups

# 특정 그룹의 사진으로 영상 생성
node src/index.js create -g <group_id> --auto
```

---

## Known Issues

콘텐츠 퀄리티 관련 이슈 및 개선 로드맵: **[docs/QUALITY_ISSUES.md](docs/QUALITY_ISSUES.md)**

| 이슈 | 제목 | 우선순위 |
|------|------|----------|
| #9 | 콘텐츠 퀄리티 종합 개선 | P0-P3 |
| #7 | 자막 퀄리티 개선 | P0 (진행 중) |
| #6 | 이미지 정렬 기준 불명확 | P1 |

---

## Do Not

- **.env 파일 커밋 금지** - 인증 정보 및 API 키 포함 (`.gitignore`에 등록됨)
- **temp/ 디렉토리 수동 삭제 금지** - 영상 생성 중 사용
- **package.json의 editly 의존성** - 현재 미사용 (FFmpeg 직접 호출)
- **API 키 하드코딩 금지** - 환경변수 사용 필수 (`.env` 또는 시스템 환경변수)
