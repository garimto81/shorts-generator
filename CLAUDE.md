# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Shorts Generator** - PocketBase 클라우드에서 사진을 가져와 마케팅용 쇼츠 영상을 생성하는 CLI 도구

| 항목 | 내용 |
|------|------|
| Runtime | Node.js 18+ (ES Modules) |
| Video Engine | Editly (FFmpeg wrapper) |
| CLI | Commander.js + Inquirer (대화형) |
| Backend | PocketHost.io (PocketBase 클라우드) |
| API Client | PocketBase JavaScript SDK |

---

## Setup

### 1. PocketHost 초기 설정

```bash
# Superuser 생성 (브라우저에서)
# https://union-public.pockethost.io/_/

# photos 컬렉션 생성 (스크립트)
node scripts/setup-pocketbase.js
```

### 2. Docker 빌드

```bash
docker-compose build shorts-gen
```

---

## Commands

```bash
# 기본 명령어
docker-compose run --rm shorts-gen list           # 사진 목록 조회
docker-compose run --rm shorts-gen create --auto  # 자동 모드 (최신 5개)
docker-compose run --rm -it shorts-gen create     # 대화형 모드
docker-compose run --rm shorts-gen config         # 설정 확인

# CLI 옵션
docker-compose run --rm shorts-gen list -n 50                      # 최대 50개
docker-compose run --rm shorts-gen list --since 2025-12-01         # 날짜 필터
docker-compose run --rm shorts-gen create --ids id1,id2,id3        # 특정 ID
docker-compose run --rm shorts-gen create --bgm /app/assets/bgm/music.mp3  # BGM 지정
docker-compose run --rm shorts-gen create --transition crossfade   # 전환 효과

# 로컬 개발 (Node.js + FFmpeg 필요)
npm install
node src/index.js list
node src/index.js create --auto
```

---

## Architecture

```
src/
├── index.js              # CLI entry - Commander 명령어 정의
├── api/
│   └── pocketbase.js     # PocketBase SDK 클라이언트
├── video/
│   ├── generator.js      # Editly 영상 생성 (핵심 로직)
│   ├── subtitle.js       # 자막 포맷팅 (줄바꿈 처리)
│   └── templates.js      # 영상 템플릿 프리셋
└── utils/
    └── downloader.js     # 파일 다운로드 유틸리티

scripts/
└── setup-pocketbase.js   # PocketBase 초기 설정 스크립트
```

### Data Flow

```
PocketHost.io → PocketBase SDK → downloadImage() → generateVideo() → MP4
      ↓              ↓                 ↓                  ↓
  클라우드 DB    fetchPhotos()     temp/{id}.jpg     Editly/FFmpeg
```

### 핵심 모듈 관계

- **pocketbase.js**: PocketBase SDK로 인증 + 데이터 조회
  - `pb.collection('_superusers').authWithPassword()` - Admin 로그인
  - `pb.collection('photos').getList()` - 사진 목록
  - `pb.files.getURL()` - 파일 URL 생성
- **generator.js**: photos 배열 받아 Editly config 생성
  - Ken Burns 효과: 짝수 인덱스=zoom in, 홀수=zoom out
  - 자막: photo.title → formatSubtitle()로 15자 줄바꿈

### PocketBase 스키마 (photos 컬렉션)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 레코드 ID |
| `title` | string | 사진 제목 (자막으로 사용) |
| `image` | file | 원본 이미지 |
| `thumbnail` | file | 썸네일 (optional) |
| `created` | datetime | 생성일시 |

---

## Configuration

**config.json**:

```json
{
  "pocketbase": {
    "url": "https://union-public.pockethost.io",
    "collection": "photos",
    "auth": {
      "email": "admin@example.com",
      "password": "password"
    }
  }
}
```

| 섹션 | 키 | 설명 |
|------|-----|------|
| `pocketbase` | `url`, `collection`, `auth` | PocketHost 연결 정보 |
| `video` | `width`, `height`, `fps`, `photoDuration`, `transition` | 영상 규격 |
| `branding` | `logo`, `logoPosition`, `enabled` | 로고 오버레이 |
| `subtitle` | `font`, `fontSize`, `textColor` | 자막 스타일 |

---

## Do Not

- config.json의 `pocketbase.auth` 정보를 Git에 커밋 (민감 정보)
- temp/ 디렉토리 수동 삭제 (영상 생성 중 사용)
- PocketHost Superuser 계정 공유
