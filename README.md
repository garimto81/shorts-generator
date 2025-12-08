# Shorts Generator - 클라우드 이미지 → 쇼츠 영상 생성

Docker 기반 CLI 도구로 PocketBase에서 이미지를 가져와 마케팅 영상을 생성합니다.

## Features

- 📷 PocketBase API 연동 (사진 목록 조회/다운로드)
- 🎬 Editly 기반 1080x1920 영상 생성
- 🎵 BGM 믹싱 (대화형 선택 또는 CLI 옵션)
- 📝 한글 자막 (NotoSansKR 폰트)
- 🏷️ 로고 오버레이 (우측 상단)
- 🔄 Ken Burns 효과 (확대/축소)
- ✨ 10종 전환 효과
- 🐳 Docker 컨테이너 (FFmpeg/네이티브 의존성 포함)

## Prerequisites

- Docker Desktop
- Docker Compose

## Setup

```bash
# PocketBase 시작 (백그라운드)
docker-compose up -d pocketbase

# shorts-gen 이미지 빌드
docker-compose build shorts-gen
```

## Commands

```bash
# 사진 목록 조회
docker-compose run --rm shorts-gen list
docker-compose run --rm shorts-gen list --limit 10
docker-compose run --rm shorts-gen list --since 2025-12-01

# 영상 생성 (대화형) - 반드시 -it 옵션 필요
docker-compose run --rm -it shorts-gen create

# 영상 생성 (자동 - 최신 5개)
docker-compose run --rm shorts-gen create --auto
docker-compose run --rm shorts-gen create --auto --count 10

# ID로 사진 지정
docker-compose run --rm shorts-gen create --ids abc123,def456,ghi789

# BGM 지정 (컨테이너 내부 경로)
docker-compose run --rm shorts-gen create --bgm /app/assets/bgm/music.mp3

# 로고 비활성화
docker-compose run --rm shorts-gen create --no-logo

# 전환 효과 지정
docker-compose run --rm shorts-gen create --transition crossfade

# 출력 경로 지정 (컨테이너 내부 경로)
docker-compose run --rm shorts-gen create --output /app/output/my-video.mp4

# 설정 확인
docker-compose run --rm shorts-gen config
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
│   │   └── pocketbase.js  # PocketBase API 클라이언트
│   ├── video/
│   │   ├── generator.js   # Editly 영상 생성
│   │   ├── templates.js   # 영상 템플릿
│   │   └── subtitle.js    # 자막 유틸리티
│   └── utils/
│       └── downloader.js  # 이미지 다운로더
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

`config.json`에서 영상 설정 변경:

```json
{
  "video": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "photoDuration": 3,
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

BGM 파일을 `assets/bgm/` 폴더에 추가하면 대화형 모드에서 선택 가능:

```bash
cp my-music.mp3 assets/bgm/
# 컨테이너 내부 경로: /app/assets/bgm/my-music.mp3
```

### Logo

로고 이미지를 `assets/logo.png`로 저장:

```bash
# PNG 권장 (투명 배경)
# 크기: 200x200px 정도
```

### Korean Font

한글 자막용 폰트를 `assets/fonts/`에 추가:

```bash
# NotoSansKR 다운로드
# https://fonts.google.com/noto/specimen/Noto+Sans+KR
# → NotoSansKR-Bold.otf 저장
```

## Integration with Field Uploader

Field Uploader (PRD-0013)에서 업로드한 사진을 사용합니다:

```
스마트폰 (Field Uploader) → PocketBase → Docker (Shorts Generator)
     📷 촬영                   ☁️ 저장       🎬 영상 생성
```

생성된 영상은 호스트의 `output/` 폴더에 저장됩니다.

## Troubleshooting

### PocketBase 연결 실패

```bash
# PocketBase 컨테이너 상태 확인
docker-compose ps

# PocketBase 재시작
docker-compose restart pocketbase

# 로그 확인
docker-compose logs pocketbase
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
# 폰트 파일 확인 (호스트)
ls assets/fonts/

# NotoSansKR-Bold.otf 파일이 없으면 Google Fonts에서 다운로드
```

## License

MIT
