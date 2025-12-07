# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Shorts Generator** - 휠 복원 마케팅 담당자를 위한 PC 쇼츠 영상 생성 CLI

| 레이어 | 기술 |
|--------|------|
| Runtime | Node.js 18+ |
| CLI | Commander.js |
| Video | FFmpeg (editly) |
| API | PocketBase SDK |

---

## Requirements

- **Node.js 18+**
- **FFmpeg** (`winget install FFmpeg`)

---

## Commands

```bash
npm install                    # Install dependencies

# 기본 사용
node src/index.js list         # 완료된 작업 사진 목록
node src/index.js create       # 쇼츠 영상 생성
node src/index.js create -j WHL250112001  # 특정 작업번호

# 전역 CLI 등록 (선택)
npm link                       # 전역 등록
shorts-gen list                # 전역 명령어 사용
shorts-gen create
```

---

## Architecture

```
src/
├── index.js                   # CLI entry (Commander.js)
├── api/
│   └── pocketbase.js          # PocketBase API 클라이언트
├── video/
│   ├── templates.js           # 영상 템플릿 (Before/After)
│   └── subtitle.js            # 자막 생성
└── utils/
    └── downloader.js          # 사진 다운로드
output/                        # 생성된 영상 출력
assets/                        # 폰트, 음악 등 리소스
config.json                    # PocketBase URL, 설정
```

### Data Flow

```
PocketBase API → 사진 다운로드 → FFmpeg 영상 생성 → output/에 저장
                     ↓
              Before/After 템플릿 적용
```

---

## Video Output

- **해상도**: 1080x1920 (세로 9:16)
- **포맷**: MP4 (H.264)
- **템플릿**: Before → During → After 시퀀스

---

## Related Repositories

| 레포 | 용도 |
|------|------|
| [contents-factory](https://github.com/garimto81/contents-factory) | 메인 PWA + PocketBase 서버 |
| [field-uploader](https://github.com/garimto81/field-uploader) | 스마트폰 사진 촬영 PWA |

---

## Configuration

```json
// config.json
{
  "pocketbase": {
    "url": "http://localhost:8090"
  },
  "output": {
    "dir": "./output",
    "format": "mp4"
  }
}
```
