# Shorts Generator

클라우드 이미지로 쇼츠/릴스 영상을 자동 생성합니다.

## 사전 요구사항

### FFmpeg 설치 (필수)
```bash
# Windows (winget)
winget install FFmpeg

# Windows (Chocolatey)
choco install ffmpeg

# 확인
ffmpeg -version
```

### 한글 폰트 (선택)
`assets/fonts/` 폴더에 NotoSansKR-Bold.otf 파일을 추가하세요.
https://fonts.google.com/noto/specimen/Noto+Sans+KR

## 설치

```bash
npm install
npm link  # 전역 CLI 등록 (선택)
```

## 사용법

### 사진 목록 조회
```bash
shorts-gen list
shorts-gen list -n 50  # 50개 조회
```

### 영상 생성
```bash
# 대화형 모드
shorts-gen create

# 자동 모드 (최신 5개)
shorts-gen create --auto

# 옵션 지정
shorts-gen create --auto -n 10 --bgm ./my-bgm.mp3 -o ./my-video.mp4
```

## 설정

`config.json`에서 설정 변경:

- PocketBase 서버 URL
- 영상 해상도 (기본: 1080x1920)
- 사진 표시 시간 (기본: 3초)
- 전환 효과 (기본: directionalwipe)

## 출력

- 포맷: MP4 (H.264)
- 해상도: 1080x1920 (세로)
- FPS: 30
