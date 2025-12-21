# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **전역 규칙 적용**: [상위 CLAUDE.md](../CLAUDE.md) 참조

---

## Project Overview

**Shorts Generator** - PocketBase 클라우드에서 사진을 가져와 마케팅용 쇼츠 영상을 생성하는 CLI 도구

| 항목 | 내용 |
|------|------|
| Runtime | Node.js 18+ (ES Modules) |
| Video Engine | FFmpeg (직접 spawn, Editly 미사용) |
| CLI | Commander.js + Inquirer (대화형) |
| Backend | PocketHost.io (PocketBase 클라우드) |
| API Client | PocketBase JavaScript SDK |

---

## Commands

```bash
# Docker 환경 (권장)
docker-compose build shorts-gen                   # 최초 빌드
docker-compose run --rm shorts-gen list           # 사진 목록 조회
docker-compose run --rm shorts-gen create --auto  # 자동 모드 (최신 5개)
docker-compose run --rm -it shorts-gen create     # 대화형 모드 (반드시 -it 필요)
docker-compose run --rm shorts-gen config         # 설정 확인

# PocketBase 초기 설정
node scripts/setup-pocketbase.js                  # photos 컬렉션 생성

# 로컬 개발 (Node.js 18+ / FFmpeg 필수)
ffmpeg -version                               # FFmpeg 설치 확인
npm install
node src/index.js list
node src/index.js create --auto

# Docker 재빌드 (문제 발생 시)
docker-compose build --no-cache shorts-gen
```

### CLI 옵션

| 명령어 | 옵션 | 설명 |
|--------|------|------|
| `list` | `-n 50` | 최대 조회 개수 |
| `list` | `--since 2025-12-01` | 날짜 필터 |
| `create` | `--auto` | 자동 모드 (최신 N개 사용) |
| `create` | `--ids id1,id2` | 특정 사진 ID 지정 |
| `create` | `--bgm /app/assets/bgm/music.mp3` | BGM 지정 |
| `create` | `--no-logo` | 로고 비활성화 |

---

## Architecture

```
src/
├── index.js              # CLI entry - Commander 명령어 정의
├── api/
│   └── pocketbase.js     # PocketBase SDK 클라이언트 (인증/조회/다운로드)
├── video/
│   ├── generator.js      # FFmpeg spawn (영상 생성, input_list.txt → MP4)
│   ├── subtitle.js       # 자막 포맷팅 (15자 줄바꿈)
│   └── templates.js      # 영상 템플릿 프리셋 (미사용)
└── utils/
    └── downloader.js     # 파일 다운로드 유틸리티

scripts/
└── setup-pocketbase.js   # PocketBase photos 컬렉션 초기화
```

### Data Flow

```
PocketHost.io → fetchPhotos() → downloadImage() → generateVideo() → MP4
      ↓              ↓               ↓                  ↓
  photos 컬렉션    배열 반환      temp/{id}.jpg      FFmpeg concat
```

### 핵심 모듈

| 모듈 | 역할 |
|------|------|
| `pocketbase.js` | `_superusers` 인증, `photos` 컬렉션 조회, `pb.files.getURL()` 파일 URL |
| `generator.js` | FFmpeg concat demuxer로 슬라이드쇼 생성 (`spawn('ffmpeg', args)`) |
| `subtitle.js` | `formatSubtitle(text, 15)` - 15자 단위 줄바꿈 |

### PocketBase 스키마 (photos 컬렉션)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 레코드 ID |
| `title` | string | 사진 제목 (자막으로 사용) |
| `image` | file | 원본 이미지 |
| `thumbnail` | file | 썸네일 (optional) |

---

## Configuration

**config.json** 주요 설정:

| 섹션 | 키 | 설명 |
|------|-----|------|
| `pocketbase` | `url`, `collection`, `auth` | PocketHost 연결 정보 |
| `video` | `width`, `height`, `fps`, `photoDuration` | 영상 규격 (기본 1080x1920, 30fps) |
| `branding` | `logo`, `logoPosition`, `enabled` | 로고 오버레이 (현재 비활성화) |
| `subtitle` | `font`, `fontSize`, `textColor` | 자막 스타일 (NotoSansKR 폰트) |

---

## Debugging

```bash
# Docker 로그 확인
docker-compose logs shorts-gen

# FFmpeg 상세 로그 (generator.js stdio: 'inherit')
# 영상 생성 시 콘솔에 FFmpeg 출력 표시됨

# PocketHost 연결 테스트
curl https://union-public.pockethost.io/api/health
```

---

## Do Not

- **config.json 커밋 금지** - `pocketbase.auth` 인증 정보 포함 (민감 정보)
- temp/ 디렉토리 수동 삭제 금지 (영상 생성 중 사용)
- PocketHost Superuser 계정 공유 금지
