# Few-Shot 예시 템플릿 가이드

이 폴더에는 AI 자막 생성을 위한 Few-Shot 예시 템플릿이 저장됩니다.

## 사용 방법

### 1. 내장 템플릿 사용 (기본)

```bash
# wheelRestoration 템플릿 자동 적용
node src/index.js create -g <id> --auto --ai-subtitle --prompt-template wheelRestoration
```

### 2. 커스텀 예시 파일 사용

```bash
# 커스텀 예시 파일 지정
node src/index.js create -g <id> --auto --ai-subtitle \
  --examples-file assets/prompts/examples/my-custom.json
```

## 예시 파일 구조

```json
{
  "templateName": "myTemplate",
  "version": "1.0",
  "description": "템플릿 설명",
  "examples": {
    "positive": [
      {
        "context": "이미지 상황 설명",
        "caption": "좋은 자막 예시",
        "tags": ["태그1", "태그2"]
      }
    ],
    "negative": [
      {
        "caption": "피해야 할 자막",
        "reason": "피해야 하는 이유"
      }
    ]
  },
  "styleGuide": {
    "tone": "professional|friendly|casual",
    "minLength": 25,
    "maxLength": 40,
    "preferWords": ["선호단어1", "선호단어2"],
    "avoidWords": ["금지단어1", "금지단어2"],
    "avoidPatterns": ["!!", "~~"]
  }
}
```

## 필드 설명

### examples.positive (필수)
- **context**: 이미지 상황 설명 (AI 참고용)
- **caption**: 좋은 자막 예시 (Few-Shot 학습)
- **tags**: 분류 태그 (선택)

### examples.negative (선택)
- **caption**: 피해야 할 자막
- **reason**: 피해야 하는 이유

### styleGuide (선택)
- **tone**: 전체 톤 (professional, friendly, casual)
- **minLength/maxLength**: 자막 글자 수 범위
- **preferWords**: AI가 선호해야 할 단어
- **avoidWords**: AI가 피해야 할 단어
- **avoidPatterns**: 피해야 할 패턴 (이모티콘 등)

## 내장 템플릿

| 템플릿명 | 파일 | 설명 |
|---------|------|------|
| wheelRestoration | `examples/wheelRestoration.json` | 휠 복원 작업 |

## 새 템플릿 추가

1. `examples/` 폴더에 JSON 파일 생성
2. 파일명을 템플릿명과 동일하게 (예: `product.json`)
3. `--prompt-template product`로 사용

## 예시 개수 권장

- **최소**: 5개 positive 예시
- **권장**: 10개 positive + 3개 negative 예시
- positive 예시가 많을수록 AI 응답 일관성 향상
