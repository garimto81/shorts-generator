/**
 * Few-Shot 예시 템플릿 로더
 *
 * JSON 파일에서 예시 템플릿을 로드하고 Few-Shot 프롬프트를 구성합니다.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, '../../assets/prompts/examples');

/**
 * 예시 템플릿 파일 로드
 * @param {string} templateName - 템플릿 이름 (예: 'wheelRestoration')
 * @returns {Object|null} 예시 데이터 또는 null
 */
export function loadExamples(templateName) {
  const filePath = join(EXAMPLES_DIR, `${templateName}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return validateExamples(data) ? data : null;
  } catch (error) {
    console.warn(`예시 파일 로드 실패: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 커스텀 경로에서 예시 파일 로드
 * @param {string} customPath - 커스텀 JSON 파일 경로
 * @returns {Object|null} 예시 데이터 또는 null
 */
export function loadExamplesFromPath(customPath) {
  const filePath = isAbsolute(customPath)
    ? customPath
    : join(process.cwd(), customPath);

  if (!existsSync(filePath)) {
    console.warn(`커스텀 예시 파일을 찾을 수 없습니다: ${filePath}`);
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return validateExamples(data) ? data : null;
  } catch (error) {
    console.warn(`커스텀 예시 파일 로드 실패: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 예시 데이터 유효성 검증
 * @param {Object} data - 예시 데이터
 * @returns {boolean} 유효 여부
 */
export function validateExamples(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // 필수 필드 검증
  if (!data.templateName || !data.examples) {
    console.warn('예시 파일에 templateName 또는 examples가 없습니다.');
    return false;
  }

  // positive 예시 검증
  if (!data.examples.positive || !Array.isArray(data.examples.positive)) {
    console.warn('positive 예시 배열이 필요합니다.');
    return false;
  }

  if (data.examples.positive.length < 3) {
    console.warn('최소 3개 이상의 positive 예시가 필요합니다.');
    return false;
  }

  // 각 예시 항목 검증
  for (const example of data.examples.positive) {
    if (!example.caption) {
      console.warn('예시에 caption이 필요합니다.');
      return false;
    }
  }

  return true;
}

/**
 * Few-Shot 프롬프트 구성
 * @param {Object} examplesData - 로드된 예시 데이터
 * @param {Object} options - 옵션 (maxPositive, includeNegative 등)
 * @returns {string} 구성된 Few-Shot 프롬프트
 */
export function buildFewShotPrompt(examplesData, options = {}) {
  const {
    maxPositive = 5,
    includeNegative = true,
    includeStyleGuide = true
  } = options;

  const { examples, styleGuide } = examplesData;
  let prompt = '';

  // 긍정적 예시
  if (examples.positive?.length) {
    prompt += '\n[좋은 자막 예시]\n';
    const positiveExamples = examples.positive.slice(0, maxPositive);
    positiveExamples.forEach(ex => {
      const context = ex.context ? ` (${ex.context})` : '';
      prompt += `- "${ex.caption}"${context}\n`;
    });
  }

  // 부정적 예시
  if (includeNegative && examples.negative?.length) {
    prompt += '\n[피해야 할 표현]\n';
    examples.negative.forEach(ex => {
      const reason = ex.reason ? ` → ${ex.reason}` : '';
      prompt += `- "${ex.caption}"${reason}\n`;
    });
  }

  // 스타일 가이드
  if (includeStyleGuide && styleGuide) {
    prompt += '\n[스타일 가이드]\n';

    if (styleGuide.tone) {
      prompt += `- 톤: ${styleGuide.tone}\n`;
    }

    if (styleGuide.minLength || styleGuide.maxLength) {
      const min = styleGuide.minLength || 15;
      const max = styleGuide.maxLength || 40;
      prompt += `- 글자 수: ${min}-${max}자\n`;
    }

    if (styleGuide.preferWords?.length) {
      prompt += `- 선호 단어: ${styleGuide.preferWords.slice(0, 10).join(', ')}\n`;
    }

    if (styleGuide.avoidWords?.length) {
      prompt += `- 금지 단어: ${styleGuide.avoidWords.slice(0, 10).join(', ')}\n`;
    }

    if (styleGuide.avoidPatterns?.length) {
      prompt += `- 금지 패턴: ${styleGuide.avoidPatterns.join(', ')}\n`;
    }
  }

  return prompt;
}


/**
 * Phase 기반 필터링된 Few-Shot 프롬프트 구성 (P1)
 * v2.0: phase 필드 직접 사용 + 태그 기반 fallback
 *
 * @param {Object} examplesData - 로드된 예시 데이터
 * @param {Object} options - 옵션
 * @param {number} options.maxPositive - 최대 긍정 예시 개수 (기본 5)
 * @param {boolean} options.includeNegative - 부정 예시 포함 여부 (기본 true)
 * @param {boolean} options.includeStyleGuide - 스타일 가이드 포함 여부 (기본 true)
 * @param {string} options.filterPhase - 필터링할 Phase (overview/before/process/after)
 * @returns {string} 구성된 Few-Shot 프롬프트
 */
export function buildFewShotPromptFiltered(examplesData, options = {}) {
  const {
    maxPositive = 5,
    includeNegative = true,
    includeStyleGuide = true,
    filterPhase = null
  } = options;

  const { examples, styleGuide } = examplesData;
  let prompt = '';

  // Phase-Tag 매핑 (레거시 지원)
  const phaseTags = {
    overview: ['intro', 'customer-wish', 'overview'],
    before: ['inspection', 'damage', 'before', 'professional', 'scratch', 'severe'],
    process: ['process', 'cleaning', 'precision', 'skill', 'cnc', 'welding', 'painting', 'powder-coating', 'clear-coat', 'safety'],
    after: ['finishing', 'result', 'satisfaction', 'performance', 'expertise', 'detail', 'protection', 'durability', 'after', 'new-car', 'charisma', 'dignity', 'customer', 'balance', 'value']
  };

  // 긍정적 예시 필터링
  if (examples.positive?.length) {
    let positiveExamples = examples.positive;

    // P1: Phase 필터링
    if (filterPhase) {
      // 우선: phase 필드로 직접 필터링 (v2.0)
      const phaseFiltered = examples.positive.filter(ex => ex.phase === filterPhase);

      if (phaseFiltered.length >= 2) {
        positiveExamples = phaseFiltered;
      } else if (phaseTags[filterPhase]) {
        // Fallback: 태그 기반 필터링 (레거시)
        const targetTags = phaseTags[filterPhase];
        const tagFiltered = examples.positive.filter(ex =>
          ex.tags?.some(tag => targetTags.includes(tag))
        );

        if (tagFiltered.length >= 2) {
          positiveExamples = tagFiltered;
        }
        // 둘 다 2개 미만이면 전체 예시 사용
      }
    }

    // Phase별 라벨 생성
    const phaseLabels = {
      overview: '차량 소개',
      before: '복원 전 상태',
      process: '작업 과정',
      after: '복원 완료'
    };

    const phaseLabel = filterPhase
      ? `[${phaseLabels[filterPhase] || filterPhase} 단계 예시]`
      : '[좋은 자막 예시]';

    prompt += `\n${phaseLabel}\n`;
    positiveExamples.slice(0, maxPositive).forEach(ex => {
      const context = ex.context ? ` (${ex.context})` : '';
      prompt += `- "${ex.caption}"${context}\n`;
    });

    // Phase별 가이드라인 추가 (styleGuide.phaseGuidelines 활용)
    if (filterPhase && styleGuide?.phaseGuidelines?.[filterPhase]) {
      const phaseGuide = styleGuide.phaseGuidelines[filterPhase];
      prompt += `\n[${phaseLabels[filterPhase]} 지침]\n`;
      prompt += `- ${phaseGuide.description}\n`;
    }
  }

  // 부정적 예시 (기존 로직 유지)
  if (includeNegative && examples.negative?.length) {
    prompt += '\n[피해야 할 표현]\n';
    examples.negative.forEach(ex => {
      const reason = ex.reason ? ` → ${ex.reason}` : '';
      prompt += `- "${ex.caption}"${reason}\n`;
    });
  }

  // 스타일 가이드 (기존 로직 유지)
  if (includeStyleGuide && styleGuide) {
    prompt += '\n[스타일 가이드]\n';

    if (styleGuide.tone) {
      prompt += `- 톤: ${styleGuide.tone}\n`;
    }

    if (styleGuide.minLength || styleGuide.maxLength) {
      const min = styleGuide.minLength || 15;
      const max = styleGuide.maxLength || 40;
      prompt += `- 글자 수: ${min}-${max}자\n`;
    }

    if (styleGuide.preferWords?.length) {
      prompt += `- 선호 단어: ${styleGuide.preferWords.slice(0, 10).join(', ')}\n`;
    }

    if (styleGuide.avoidWords?.length) {
      prompt += `- 금지 단어: ${styleGuide.avoidWords.slice(0, 10).join(', ')}\n`;
    }

    if (styleGuide.avoidPatterns?.length) {
      prompt += `- 금지 패턴: ${styleGuide.avoidPatterns.join(', ')}\n`;
    }
  }

  return prompt;
}

/**
 * 예시 템플릿 정보 조회
 * @param {string} templateName - 템플릿 이름
 * @returns {Object|null} 템플릿 요약 정보
 */
export function getExamplesInfo(templateName) {
  const data = loadExamples(templateName);
  if (!data) return null;

  return {
    name: data.templateName,
    version: data.version || '1.0',
    description: data.description || '',
    positiveCount: data.examples?.positive?.length || 0,
    negativeCount: data.examples?.negative?.length || 0,
    hasStyleGuide: !!data.styleGuide,
    tone: data.styleGuide?.tone || 'default',
    lengthRange: data.styleGuide
      ? `${data.styleGuide.minLength || 15}-${data.styleGuide.maxLength || 40}자`
      : '15-40자'
  };
}
