# Shorts Generator - 클라우드 이미지 → 쇼츠 영상 생성

PC용 CLI 도구로 PocketBase에서 이미지를 가져와 마케팅 영상을 생성합니다.

## Features

- 📷 PocketBase API 연동 (사진 목록 조회/다운로드)
- 🎬 Editly 기반 1080x1920 영상 생성
- 🎵 BGM 믹싱 (대화형 선택 또는 CLI 옵션)
- 📝 한글 자막 (NotoSansKR 폰트)
- 🏷️ 로고 오버레이 (우측 상단)
- 🔄 Ken Burns 효과 (확대/축소)
- ✨ 10종 전환 효과

## Prerequisites

```bash
# FFmpeg 설치 필수
winget install FFmpeg
# 또는
choco install ffmpeg

# 확인
ffmpeg -version
```

## Setup

```bash
# Install dependencies
npm install

# Global CLI registration (optional)
npm link

# Run directly
node src/index.js list
node src/index.js create

# Or with global link
shorts-gen list
shorts-gen create
```

## Commands

```bash
# 사진 목록 조회
shorts-gen list
shorts-gen list --limit 10
shorts-gen list --since 2025-12-01

# 영상 생성 (대화형)
shorts-gen create

# 영상 생성 (자동 - 최신 5개)
shorts-gen create --auto
shorts-gen create --auto --count 10

# ID로 사진 지정
shorts-gen create --ids abc123,def456,ghi789

# BGM 지정
shorts-gen create --bgm ./my-bgm.mp3

# 로고 비활성화
shorts-gen create --no-logo

# 전환 효과 지정
shorts-gen create --transition crossfade

# 출력 경로 지정
shorts-gen create --output ./my-video.mp4

# 설정 확인
shorts-gen config
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

### BGM Files

BGM 파일을 `assets/bgm/` 폴더에 추가하면 대화형 모드에서 선택 가능:

```bash
# 예시
cp my-music.mp3 assets/bgm/
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
스마트폰 (Field Uploader) → PocketBase → PC (Shorts Generator)
     📷 촬영                   ☁️ 저장       🎬 영상 생성
```

## Troubleshooting

### FFmpeg not found

```bash
# PATH 확인
ffmpeg -version

# Windows: 환경변수에 FFmpeg bin 경로 추가
# 또는 재설치: winget install FFmpeg
```

### PocketBase connection failed

```bash
# PocketBase 서버 실행 확인
curl http://localhost:8090/api/health

# config.json의 URL 확인
cat config.json | grep url
```

### 한글 깨짐

```bash
# NotoSansKR 폰트 설치 확인
ls assets/fonts/

# 폰트 파일 없으면 다운로드
```

## License

MIT
