# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Shorts Generator** - PocketBase에서 사진을 가져와 마케팅용 쇼츠 영상을 생성하는 CLI 도구

| 항목 | 내용 |
|------|------|
| Runtime | Node.js 18+ (ES Modules) |
| Video Engine | Editly (FFmpeg wrapper) |
| CLI | Commander.js + Inquirer (대화형) |

---

## Commands

```bash
# 초기 설정
docker-compose up -d pocketbase     # PocketBase 시작 (최초 1회)
docker-compose build shorts-gen     # 이미지 빌드

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
```

---

## Architecture

```
src/
├── index.js              # CLI entry - Commander 명령어 정의
├── api/
│   └── pocketbase.js     # PocketBase REST API 클라이언트
├── video/
│   ├── generator.js      # Editly 영상 생성 (핵심 로직)
│   ├── subtitle.js       # 자막 포맷팅 (줄바꿈 처리)
│   └── templates.js      # 영상 템플릿 프리셋
└── utils/
    └── downloader.js     # 파일 다운로드 유틸리티
```

### Data Flow

```
PocketBase API → fetchPhotos() → downloadImage() → generateVideo() → MP4
     ↓                ↓                ↓                 ↓
  사진 목록        photo 객체      temp/{id}.jpg    Editly/FFmpeg
```

### 핵심 모듈 관계

- **index.js**: CLI 파싱 → `pocketbase.js` 호출 → `generator.js` 실행
- **generator.js**: photos 배열 받아 Editly config 생성
  - Ken Burns 효과: 짝수 인덱스=zoom in, 홀수=zoom out (0.1 비율)
  - 로고: 각 clip의 layers에 추가 (position 기반)
  - 자막: photo.title → formatSubtitle()로 15자 줄바꿈
- **pocketbase.js**: REST API로 사진 목록 조회 + 이미지 다운로드 (Buffer → temp/ 저장)

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

**config.json** 주요 설정:

| 섹션 | 키 | 설명 |
|------|-----|------|
| `pocketbase` | `url`, `collection` | API 엔드포인트 |
| `video` | `width`, `height`, `fps`, `photoDuration`, `transition` | 영상 규격 |
| `branding` | `logo`, `logoPosition`, `enabled` | 로고 오버레이 |
| `subtitle` | `font`, `fontSize`, `textColor` | 자막 스타일 |

---

## Do Not

- config.json의 `pocketbase.url` 변경 (`http://pocketbase:8090`은 Docker 내부 네트워크용)
- temp/ 디렉토리 수동 삭제 (영상 생성 중 사용)
- 로컬(Native) 실행 시도 → Docker 전용 프로젝트
