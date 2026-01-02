/**
 * AI 자막 생성을 위한 프롬프트 템플릿
 *
 * 각 템플릿은 특정 유형의 이미지에 최적화된 마케팅 자막을 생성합니다.
 *
 * v2.0: Few-Shot Examples Library 지원
 * - 외부 JSON 파일에서 예시 로드 (assets/prompts/examples/)
 * - 스타일 가이드 (선호/금지 단어, 톤) 지원
 * - 커스텀 예시 파일 경로 지원
 */

import { loadExamples, loadExamplesFromPath, buildFewShotPrompt, buildFewShotPromptFiltered } from './examples-loader.js';

/**
 * 기본 프롬프트 지시문 (예시 없이)
 * Few-Shot 예시는 외부 파일에서 동적으로 로드됩니다.
 */
export const BASE_INSTRUCTIONS = {
  default: `이 이미지를 분석하고 마케팅용 자막을 생성해주세요.

요구사항:
- 감탄사, 이모지 없이 간결하게
- 제품/서비스의 가치를 강조
- 자막 텍스트만 출력 (설명 없이)`,

  product: `제품 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 제품의 핵심 특징/가치 강조
- 구매 욕구를 자극하는 문구
- 자막 텍스트만 출력`,

  food: `음식/음료 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 맛, 향, 질감의 매력 강조
- 식욕을 자극하는 표현
- 자막 텍스트만 출력`,

  wheelRestoration: `휠 복원 작업 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 전문성과 품질 강조
- 변화/복원의 가치 전달
- 자막 텍스트만 출력`,

  beforeAfter: `전/후 비교 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 변화의 극적인 효과 강조
- 자막 텍스트만 출력`,

  process: `서비스/작업 과정 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 전문성과 세심함 강조
- 신뢰감을 주는 표현
- 자막 텍스트만 출력`
};

/**
 * Fallback 예시 (외부 파일이 없을 경우)
 */
export const FALLBACK_EXAMPLES = {
  default: `
예시:
- "프리미엄 품질의 완벽한 마무리"
- "전문가의 손길로 되살린 광택"`,

  product: `
예시:
- "당신만을 위한 프리미엄 선택"
- "일상을 특별하게 만드는 품격"`,

  food: `
예시:
- "부드러운 크림의 완벽한 조화"
- "진한 풍미가 전하는 특별한 순간"`,

  wheelRestoration: `
예시:
- "새것처럼 되살린 휠의 광택"
- "장인의 손길로 완성된 복원"`,

  beforeAfter: `
예시:
- "놀라운 변화, 직접 확인하세요"
- "믿기 힘든 복원의 결과"`,

  process: `
예시:
- "섬세한 작업으로 완성되는 품질"
- "전문가만이 할 수 있는 디테일"`
};

export const PROMPTS = {
  /**
   * 기본 마케팅 자막 (범용)
   */
  default: `이 이미지를 분석하고 마케팅용 짧은 자막을 생성해주세요.

요구사항:
- 한글 15-20자 이내
- 감탄사, 이모지 없이 간결하게
- 제품/서비스의 가치를 강조
- 자막 텍스트만 출력 (설명 없이)

예시:
- "프리미엄 품질의 완벽한 마무리"
- "전문가의 손길로 되살린 광택"`,

  /**
   * 제품 쇼케이스
   */
  product: `제품 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 한글 15-20자 이내
- 제품의 핵심 특징/가치 강조
- 구매 욕구를 자극하는 문구
- 자막 텍스트만 출력

예시:
- "당신만을 위한 프리미엄 선택"
- "일상을 특별하게 만드는 품격"`,

  /**
   * 음식/음료
   */
  food: `음식/음료 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 한글 15-20자 이내
- 맛, 향, 질감의 매력 강조
- 식욕을 자극하는 표현
- 자막 텍스트만 출력

예시:
- "부드러운 크림의 완벽한 조화"
- "진한 풍미가 전하는 특별한 순간"`,

  /**
   * 휠 복원/자동차 서비스
   */
  wheelRestoration: `휠 복원 작업 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 한글 15-20자 이내
- 전문성과 품질 강조
- 변화/복원의 가치 전달
- 자막 텍스트만 출력

예시:
- "새것처럼 되살린 휠의 광택"
- "장인의 손길로 완성된 복원"`,

  /**
   * 전/후 비교
   */
  beforeAfter: `전/후 비교 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 한글 15자 이내
- 변화의 극적인 효과 강조
- 자막 텍스트만 출력

예시:
- "놀라운 변화, 직접 확인하세요"
- "믿기 힘든 복원의 결과"`,

  /**
   * 서비스/작업 과정
   */
  process: `서비스/작업 과정 이미지입니다. 마케팅 자막을 생성해주세요.

요구사항:
- 한글 15-20자 이내
- 전문성과 세심함 강조
- 신뢰감을 주는 표현
- 자막 텍스트만 출력

예시:
- "섬세한 작업으로 완성되는 품질"
- "전문가만이 할 수 있는 디테일"`
};

/**
 * 사용 가능한 프롬프트 템플릿 목록
 */
export const PROMPT_TYPES = Object.keys(PROMPTS);

/**
 * AI 품질 레벨별 프롬프트 수정자
 * 기본 프롬프트에 추가되어 스타일을 조절합니다.
 */
export const QUALITY_MODIFIERS = {
  /**
   * 창의적/대담한 문구 (독창적, 임팩트 있음)
   */
  creative: `
추가 지침:
- 평범한 마케팅 문구는 피하세요
- 독창적이고 기억에 남는 표현 사용
- 은유, 비유 등 문학적 표현 활용
- 감정을 자극하는 강렬한 단어 선택
- 뻔하지 않은 시각으로 접근`,

  /**
   * 균형 잡힌 문구 (기본값)
   */
  balanced: '',  // 기본 프롬프트 그대로 사용

  /**
   * 보수적/안전한 문구 (검증된 패턴)
   */
  conservative: `
추가 지침:
- 검증된 마케팅 문구 패턴 사용
- 명확하고 직관적인 표현
- 과장 표현 최소화
- 제품/서비스의 실질적 가치에 집중
- 신뢰감을 주는 차분한 톤`
};

/**
 * 품질 레벨 목록
 */
export const QUALITY_LEVELS = Object.keys(QUALITY_MODIFIERS);

/**
 * 프롬프트 템플릿 가져오기 (레거시 - 하드코딩된 예시 사용)
 * @param {string} type - 템플릿 타입
 * @param {string} quality - 품질 레벨 (creative|balanced|conservative)
 * @returns {string} 프롬프트 텍스트
 * @deprecated getPromptWithExamples() 사용 권장
 */
export function getPrompt(type = 'default', quality = 'balanced') {
  const basePrompt = PROMPTS[type] || PROMPTS.default;
  const modifier = QUALITY_MODIFIERS[quality] || '';
  return basePrompt + modifier;
}

/**
 * Few-Shot 예시가 포함된 프롬프트 가져오기 (v2.0)
 *
 * 1. 커스텀 예시 파일이 있으면 사용
 * 2. 내장 예시 파일이 있으면 사용 (assets/prompts/examples/)
 * 3. 둘 다 없으면 하드코딩된 fallback 예시 사용
 *
 * v3.2: P0+P1+P2 배치 컨텍스트 및 Phase 기반 예시 필터링 지원
 *
 * @param {string} type - 템플릿 타입
 * @param {string} quality - 품질 레벨 (creative|balanced|conservative)
 * @param {Object} options - 추가 옵션
 * @param {string} options.customExamplesPath - 커스텀 예시 파일 경로
 * @param {number} options.maxExamples - 최대 예시 개수 (기본 5)
 * @param {boolean} options.includeNegative - 부정적 예시 포함 여부 (기본 true)
 * @param {Object} options.batchContext - P0: 배치 컨텍스트 { index, total, phase, phaseInfo }
 * @param {string[]} options.previousSubtitles - P2: 이전 자막 배열
 * @returns {string} 프롬프트 텍스트
 */
export function getPromptWithExamples(type = 'default', quality = 'balanced', options = {}) {
  const {
    customExamplesPath = null,
    maxExamples = 5,
    includeNegative = true,
    // P0+P2: 배치 컨텍스트
    batchContext = null,
    previousSubtitles = []
  } = options;

  // 1. 기본 지시문
  const baseInstruction = BASE_INSTRUCTIONS[type] || BASE_INSTRUCTIONS.default;

  // 2. 예시 로드 시도
  let examplesData = null;

  // 2.1 커스텀 예시 파일 우선
  if (customExamplesPath) {
    examplesData = loadExamplesFromPath(customExamplesPath);
  }

  // 2.2 내장 예시 파일
  if (!examplesData) {
    examplesData = loadExamples(type);
  }

  // 3. Few-Shot 프롬프트 구성
  let fewShotPrompt = '';

  if (examplesData) {
    // P1: Phase가 있으면 해당 예시만 선택
    const phase = batchContext?.phase;
    fewShotPrompt = buildFewShotPromptFiltered(examplesData, {
      maxPositive: phase ? 3 : maxExamples,  // Phase 있으면 3개만
      includeNegative,
      includeStyleGuide: true,
      filterPhase: phase  // P1: Phase 필터
    });

    // 글자 수 제한 동적 적용
    const styleGuide = examplesData.styleGuide;
    if (styleGuide?.minLength || styleGuide?.maxLength) {
      const min = styleGuide.minLength || 15;
      const max = styleGuide.maxLength || 40;
      fewShotPrompt = `\n- 한글 ${min}-${max}자` + fewShotPrompt;
    }
  } else {
    // Fallback: 하드코딩된 예시 사용
    fewShotPrompt = FALLBACK_EXAMPLES[type] || FALLBACK_EXAMPLES.default;
    fewShotPrompt = '\n- 한글 15-40자' + fewShotPrompt;
  }

  // 4. P0+P2: 배치 컨텍스트 추가
  const contextPrompt = buildBatchContextPrompt(batchContext, previousSubtitles);

  // 5. 품질 수정자
  const modifier = QUALITY_MODIFIERS[quality] || '';

  return baseInstruction + fewShotPrompt + contextPrompt + modifier;
}

/**
 * 배치 컨텍스트 프롬프트 생성 (P0+P2)
 * @param {Object} batchContext - { index, total, phase, phaseInfo }
 * @param {string[]} previousSubtitles - 이전 자막 배열
 * @returns {string} 컨텍스트 프롬프트
 */
export function buildBatchContextPrompt(batchContext, previousSubtitles = []) {
  if (!batchContext) return '';

  const { index, total, phase } = batchContext;
  const progress = Math.round(((index + 1) / total) * 100);

  // Phase 한글명 매핑
  const phaseNames = {
    overview: '차량 소개',
    before: '복원 전 상태',
    process: '작업 진행 중',
    after: '복원 완료'
  };

  let contextPrompt = `

[배치 정보]
- 전체 사진: ${total}장
- 현재 순번: ${index + 1}번째 (${progress}%)`;

  // Phase 정보 (P1 연계)
  if (phase) {
    contextPrompt += `
- 작업 단계: ${phaseNames[phase] || phase}`;
  }

  // 이전 자막 (P2)
  if (previousSubtitles.length > 0) {
    contextPrompt += `
- 이전 자막들:`;
    previousSubtitles.forEach((sub, i) => {
      contextPrompt += `
  ${i + 1}. "${sub}"`;
    });
  }

  // 맥락 기반 지침
  contextPrompt += `

위 맥락을 고려하여 자막을 생성해주세요:
- 이전 자막과 자연스럽게 이어지도록
- 현재 작업 단계에 맞는 톤으로
- 순번에 따라 도입부(1-10%)/중반(11-80%)/마무리(81-100%) 구분`;

  return contextPrompt;
}

/**
 * 사용 가능한 예시 템플릿 목록 조회
 * @returns {Object} 템플릿별 예시 파일 존재 여부
 */
export function getAvailableExamples() {
  const result = {};

  for (const type of PROMPT_TYPES) {
    const examplesData = loadExamples(type);
    result[type] = {
      hasExternalExamples: !!examplesData,
      examplesCount: examplesData?.examples?.positive?.length || 0,
      hasStyleGuide: !!examplesData?.styleGuide
    };
  }

  return result;
}

// ============================================================
// v3.0: 이미지 특징 추출 및 분류 프롬프트
// ============================================================

/**
 * 이미지 특징 추출 프롬프트 (2단계 분석 시스템)
 * 휠복원 전담 앱에 최적화
 */
export const FEATURE_EXTRACTION_PROMPT = `이 휠 이미지를 분석하여 다음 정보를 JSON 형식으로 추출해주세요.

분석 항목:
1. category: 이미지 카테고리 (wheelRestoration | beforeAfter | process | default)
   - wheelRestoration: 휠 복원 완료, 광택 상태, 도색 완료
   - beforeAfter: 복원 전/후 비교
   - process: 작업 과정 (세척, 도색 중, 가공 중)
   - default: 위에 해당하지 않는 경우

2. mainSubject: 주요 피사체 (예: "BMW M3 휠", "벤츠 AMG 휠", "자동차 휠")

3. features: 이미지에서 보이는 특징 배열 (3-5개)
   색상 관련: 골드, 실버, 블랙, 화이트, 건메탈, 유광, 무광, 하이퍼 등
   가공 관련: CNC 가공, 다이아몬드 컷팅, 폴리싱, 도색 등
   상태 관련: 광택, 복원, 세척, 손상, 스크래치 등

4. confidence: 분류 확신도 (0.0-1.0)

5. reason: 분류 근거 (간단히)

출력 형식 (JSON만, 다른 텍스트 없이):
{
  "category": "wheelRestoration",
  "mainSubject": "BMW 휠",
  "features": ["골드 컬러", "CNC 가공", "광택 복원"],
  "confidence": 0.95,
  "reason": "복원 완료된 휠의 광택 상태"
}`;

/**
 * 배치 이미지 특징 추출 프롬프트
 * 여러 이미지를 한 번에 분석
 */
export const BATCH_FEATURE_EXTRACTION_PROMPT = `다음 휠 이미지들을 분석하여 각각의 특징을 JSON 배열로 추출해주세요.

분석 항목 (각 이미지별):
1. index: 이미지 순서 (0부터 시작)
2. category: wheelRestoration | beforeAfter | process | default
3. mainSubject: 주요 피사체 (브랜드 + 휠 종류)
4. features: 특징 배열 (색상, 가공 방식, 상태 등 3-5개)
5. confidence: 분류 확신도 (0.0-1.0)
6. reason: 분류 근거

출력 형식 (JSON 배열만, 다른 텍스트 없이):
[
  {
    "index": 0,
    "category": "wheelRestoration",
    "mainSubject": "BMW 휠",
    "features": ["골드", "CNC", "광택"],
    "confidence": 0.95,
    "reason": "복원 완료 상태"
  },
  {
    "index": 1,
    "category": "process",
    "mainSubject": "벤츠 휠",
    "features": ["도색 중", "마스킹"],
    "confidence": 0.9,
    "reason": "작업 과정 이미지"
  }
]`;

/**
 * 특징 기반 맞춤 자막 생성 프롬프트
 * @param {Object} analysis - 특징 추출 결과
 * @param {string} analysis.category - 카테고리
 * @param {string} analysis.mainSubject - 주요 피사체
 * @param {string[]} analysis.features - 특징 배열
 * @returns {string} 프롬프트 텍스트
 */
export function getFeatureBasedSubtitlePrompt(analysis) {
  const { category, mainSubject, features } = analysis;

  const featureText = features?.length > 0
    ? features.join(', ')
    : '고품질 복원';

  const categoryInstructions = {
    wheelRestoration: '복원 완료된 휠의 완벽함과 전문성을 강조',
    beforeAfter: '극적인 변화와 놀라운 복원 결과를 강조',
    process: '전문적인 작업 과정과 세심한 디테일을 강조',
    default: '제품의 가치와 품질을 강조'
  };

  return `휠 복원 마케팅 자막을 생성해주세요.

이미지 정보:
- 피사체: ${mainSubject || '자동차 휠'}
- 특징: ${featureText}
- 카테고리: ${category}

요구사항:
- 한글 15-25자 이내
- ${categoryInstructions[category] || categoryInstructions.default}
- 위 특징들을 자막에 반영 (색상, 가공 방식 등)
- 감탄사, 이모지 없이 전문적으로
- 자막 텍스트만 출력

예시 (특징 반영):
- "골드 CNC 가공으로 완성된 BMW 휠의 광택"
- "실버 도색 복원, 새것같은 벤츠 휠"
- "다이아몬드 컷팅의 완벽한 마무리"`;
}

// ============================================================
// v3.1: 이미지 Phase 분류 프롬프트 (AI 정렬용)
// ============================================================

/**
 * 휠 복원 작업 Phase 정의
 * 영상 생성 시 이미지 순서를 결정하는 기준
 */
export const WHEEL_RESTORATION_PHASES = {
  overview: { order: 1, name: '차량 전체', description: '전면/후면 전체 모습' },
  before: { order: 2, name: '복원 전', description: '거친 휠, 손상된 상태' },
  process: { order: 3, name: '작업 중', description: '세척, 도색, 가공 과정' },
  after: { order: 4, name: '복원 후', description: '깨끗한 광택, 완료 상태' },
  unknown: { order: 99, name: '미분류', description: '분류 실패 또는 저신뢰도' }
};

/**
 * Phase 분류 프롬프트
 * 휠 복원 작업의 논리적 순서에 맞게 이미지를 분류
 */
export const PHASE_EXTRACTION_PROMPT = `이 휠/자동차 이미지의 작업 단계(phase)를 분류해주세요.

단계 정의:
- overview: 차량 전체 모습 (전면/후면, 멀리서 촬영, 차량 전체가 보임)
- before: 복원 전 휠 상태 (거친 표면, 스크래치, 손상, 부식, 먼지)
- process: 작업 중 (세척, 도색, 마스킹, 가공, 연마, 코팅 작업)
- after: 복원 후 (광택, 깨끗함, 완료 상태, 새것같은 모습)

판단 기준:
1. 차량 전체가 보이면 → overview
2. 휠이 손상/거친 상태면 → before
3. 작업 도구/마스킹이 보이거나 작업 중이면 → process
4. 휠이 깨끗하고 광택이 나면 → after

출력 형식 (JSON만, 다른 텍스트 없이):
{
  "phase": "before",
  "phaseConfidence": 0.9,
  "phaseReason": "휠 표면에 스크래치와 손상이 보임"
}`;

/**
 * Phase 분류 프롬프트 가져오기
 * @returns {string} Phase 분류 프롬프트
 */
export function getPhasePrompt() {
  return PHASE_EXTRACTION_PROMPT;
}
