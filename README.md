# Shorts Generator - 사진 → 쇼츠 영상 생성

PocketBase에서 사진을 가져와 마케팅 영상을 생성하는 CLI 도구입니다.

## Features

- 📷 PocketBase SDK 연동 (그룹/사진 조회/다운로드)
- 📁 그룹별 사진 관리 (photo_groups 지원)
- 🎬 FFmpeg 기반 1080x1920 세로 영상 생성
- 🎵 BGM 믹싱 (대화형 선택 또는 CLI 옵션)
- 📝 한글 자막 (NotoSansKR 폰트)
- 🏷️ 로고 오버레이 (우측 상단)
- 🔄 Ken Burns 효과 (확대/축소 교차)
- ✨ 10종 전환 효과 (xfade)
- 🐳 Docker 컨테이너 (FFmpeg 포함)

## Prerequisites

- Docker Desktop (권장) 또는 Node.js 18+ / FFmpeg
- PocketBase 서버 (로컬 또는 클라우드)

## Setup

### 1. PocketBase 시작

```bash
# Docker Compose로 로컬 PocketBase 시작
docker-compose up -d pocketbase

# 상태 확인
curl http://localhost:8090/api/health
```

### 2. shorts-gen 빌드

```bash
docker-compose build shorts-gen
```

## Commands

```bash
# 그룹 목록 조회
docker-compose run --rm shorts-gen groups

# 사진 목록 조회
docker-compose run --rm shorts-gen list
docker-compose run --rm shorts-gen list --group <group-id>  # 특정 그룹
docker-compose run --rm shorts-gen list --limit 10

# 영상 생성 (대화형) - 그룹 선택 → 사진 선택
docker-compose run --rm -it shorts-gen create

# 영상 생성 (자동)
docker-compose run --rm shorts-gen create --auto
docker-compose run --rm shorts-gen create --group <id> --auto  # 특정 그룹
docker-compose run --rm shorts-gen create --auto --count 10

# ID로 사진 지정
docker-compose run --rm shorts-gen create --ids abc123,def456,ghi789

# 옵션
docker-compose run --rm shorts-gen create --bgm /app/assets/bgm/music.mp3
docker-compose run --rm shorts-gen create --no-logo
docker-compose run --rm shorts-gen create --transition crossfade

# 설정 확인
docker-compose run --rm shorts-gen config
```

### 로컬 개발 (Node.js 18+ / FFmpeg 필수)

```bash
npm install
node src/index.js groups                    # 그룹 목록
node src/index.js list --group <id>         # 그룹별 사진
node src/index.js create --group <id> --auto  # 그룹 영상 생성
```

## Available Transitions

- `directionalwipe` (기본)
- `fade`
- `crossfade`
- `slideright` / `slideleft`
- `slideup` / `slidedown`
- `radial`
- `circleopen`
- `directional`

## Project Structure

```
shorts-generator/
├── src/
│   ├── index.js           # CLI 진입점
│   ├── api/
│   │   └── pocketbase.js  # PocketBase SDK 클라이언트
│   ├── video/
│   │   ├── generator.js   # FFmpeg 영상 생성
│   │   ├── templates.js   # 영상 템플릿
│   │   └── subtitle.js    # 자막 유틸리티
│   └── utils/
│       └── downloader.js  # 이미지 다운로더
├── scripts/
│   └── setup-pocketbase.js  # PocketBase 초기 설정
├── assets/
│   ├── bgm/               # BGM 파일 (직접 추가)
│   ├── fonts/             # 한글 폰트 (NotoSansKR)
│   └── logo.png           # 브랜딩 로고
├── output/                # 생성된 영상
├── temp/                  # 임시 이미지 캐시
├── config.json            # 설정 파일
└── package.json
```

## Configuration

`config.json`에서 설정 변경:

```json
{
  "pocketbase": {
    "url": "http://localhost:8090",
    "collection": "photos",
    "auth": null
  },
  "video": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "photoDuration": 3,
    "transitionDuration": 0.5,
    "transition": "directionalwipe"
  },
  "branding": {
    "logo": "./assets/logo.png",
    "logoPosition": { "x": 0.92, "y": 0.05 },
    "logoSize": 0.12,
    "enabled": true
  },
  "subtitle": {
    "font": "./assets/fonts/NotoSansKR-Bold.otf",
    "fontSize": 60,
    "textColor": "#FFFFFF"
  }
}
```

## Adding Assets

호스트의 `assets/` 폴더가 컨테이너에 마운트됩니다 (읽기 전용).

### BGM Files

```bash
cp my-music.mp3 assets/bgm/
# 컨테이너 내부 경로: /app/assets/bgm/my-music.mp3
```

### Logo

```bash
# PNG 권장 (투명 배경)
# 크기: 200x200px 정도
cp logo.png assets/logo.png
```

### Korean Font

```bash
# NotoSansKR 다운로드
# https://fonts.google.com/noto/specimen/Noto+Sans+KR
# → assets/fonts/NotoSansKR-Bold.otf
```

## Integration with Field Uploader

Field Uploader에서 업로드한 사진을 그룹별로 관리하고 영상을 생성합니다:

```
📱 Field Uploader → 🗄️ PocketBase → 🎬 Shorts Generator
   (사진 촬영)       (localhost:8090)    (영상 생성)
       ↓                  ↓                  ↓
   photo_groups      photo_groups      groups 조회
   photos 업로드     photos 저장      --group <id>
```

**연동 예시:**

```bash
# 1. Field Uploader에서 "제품A" 그룹으로 사진 업로드

# 2. shorts-generator에서 그룹 확인
node src/index.js groups
# → [1] 제품A (abc123xyz)

# 3. 해당 그룹으로 영상 생성
node src/index.js create --group abc123xyz --auto
# → output/shorts_제품A_2025-12-22T12-00-00.mp4
```

생성된 영상은 `output/` 폴더에 저장됩니다.

## Troubleshooting

### PocketBase 연결 실패

```bash
# 서버 상태 확인
curl http://localhost:8090/api/health

# Docker로 PocketBase 시작
docker-compose up -d pocketbase
```

### 영상 생성 실패

```bash
# shorts-gen 이미지 재빌드
docker-compose build --no-cache shorts-gen

# 컨테이너 로그 확인
docker-compose logs shorts-gen
```

### 한글 깨짐

```bash
# 폰트 파일 확인
ls assets/fonts/

# NotoSansKR-Bold.otf 파일이 없으면 Google Fonts에서 다운로드
```

## License

MIT
