# Shorts Generator - Implementation Checklist

> 마지막 업데이트: 2025-12-21
> GitHub Issue: [#2 - Phase 2 영상 효과 기능 구현](https://github.com/garimto81/shorts-generator/issues/2)

---

## Phase 1: 인프라 ✅

| 상태 | 기능 | 파일 | 비고 |
|:----:|------|------|------|
| ✅ | CLI 구조 | `src/index.js` | Commander.js + Inquirer |
| ✅ | Docker 환경 | `Dockerfile` | Node.js 18 + FFmpeg |
| ✅ | PocketBase 연동 | `src/api/pocketbase.js` | SDK 인증/조회/다운로드 |
| ✅ | 기본 영상 생성 | `src/video/generator.js` | FFmpeg concat 슬라이드쇼 |
| ✅ | BGM 믹싱 | `src/video/generator.js` | 파일 존재 시 오디오 추가 |

---

## Phase 2: 영상 효과 ✅

| 상태 | 기능 | 파일 | 비고 |
|:----:|------|------|------|
| ✅ | 한글 자막 오버레이 | `src/video/generator.js` | FFmpeg drawtext 필터 적용 |
| ✅ | 로고 오버레이 | `src/video/generator.js` | FFmpeg overlay 필터 적용 |
| ✅ | Ken Burns 효과 | `src/video/generator.js` | FFmpeg zoompan 필터 (확대/축소) |
| ✅ | 전환 효과 (10종) | `src/video/generator.js` | FFmpeg xfade 필터 적용 |

---

## Phase 3: 고급 기능 🔮

| 상태 | 기능 | 파일 | 비고 |
|:----:|------|------|------|
| ❌ | 썸네일 자동 생성 | - | 영상 첫 프레임 추출 |
| ❌ | 다중 템플릿 지원 | `src/video/templates.js` | 템플릿 프리셋 활용 |
| ❌ | 영상 미리보기 | - | 저해상도 프리뷰 |

---

## 범례

- ✅ 완료
- ⏳ 진행 중
- ❌ 미구현
- 🔮 향후 계획
