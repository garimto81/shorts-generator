/**
 * AI 기반 이미지 Phase 정렬 모듈
 *
 * 휠 복원 작업의 논리적 순서에 맞게 이미지를 분류하고 정렬합니다.
 * - overview: 차량 전체 모습
 * - before: 복원 전 휠 상태
 * - process: 작업 중
 * - after: 복원 후 상태
 */

import { extractPhaseBatch } from './vision.js';
import { WHEEL_RESTORATION_PHASES } from './prompt-templates.js';

/**
 * @typedef {Object} PhaseResult
 * @property {string} phase - 작업 단계 (overview|before|process|after|unknown)
 * @property {number} phaseConfidence - 분류 신뢰도 (0.0-1.0)
 * @property {string} phaseReason - 분류 근거
 */

/**
 * 신뢰도 임계값 (이 값 미만이면 원본 순서 유지)
 */
export const PHASE_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Phase 분류 키워드 (메타데이터 힌트용)
 * v3.2: before/after 구분 정확도 개선
 */
export const PHASE_KEYWORDS = {
  overview: ['전체', '전면', '후면', '차량', '측면', 'full', 'front', 'rear', 'car', 'side'],
  before: [
    '손상', '스크래치', '거친', '부식', '오염', '먼지', '더러운', '변색', '벗겨짐',
    'before', 'scratch', 'damage', 'dirty', 'rust', 'worn'
  ],
  process: [
    '작업', '세척', '도색', '가공', '마스킹', '연마', '코팅', '스프레이', '폴리싱',
    'work', 'process', 'paint', 'coating', 'polish', 'spray'
  ],
  after: [
    '완료', '완성', '신품', '새것', '복원완료', '마무리',
    'after', 'complete', 'finish', 'done', 'restored', 'final'
  ]
};

/**
 * Phase 제외 키워드 (이 키워드가 있으면 해당 Phase가 아님)
 * 예: "광택"이 있어도 "코팅 중"이면 after가 아님
 */
export const PHASE_EXCLUDE_KEYWORDS = {
  after: ['작업', '코팅중', '도색중', '스프레이', 'process', 'coating', 'spray']
};

/**
 * 메타데이터(파일명, 제목)에서 Phase 힌트 추출
 * v3.2: 제외 키워드 고려
 * @param {Object} photo - 사진 객체
 * @returns {string|null} Phase 힌트 또는 null
 */
export function extractPhaseFromMetadata(photo) {
  // groupTitle 제외: 그룹 제목의 일반 키워드가 모든 사진에 영향을 미치는 것 방지
  const searchText = [
    photo.title || '',
    photo.image || ''
  ].join(' ').toLowerCase();

  if (!searchText.trim()) return null;

  // 각 phase별 키워드 매칭
  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        // 제외 키워드 확인
        const excludeKeywords = PHASE_EXCLUDE_KEYWORDS[phase] || [];
        const isExcluded = excludeKeywords.some(
          excl => searchText.includes(excl.toLowerCase())
        );

        if (!isExcluded) {
          return phase;
        }
      }
    }
  }

  return null;
}

/**
 * Phase 분류 (배치)
 * 1. 메타데이터 힌트 우선 적용 (비용 절감)
 * 2. 힌트 없으면 AI 분류
 *
 * @param {Array} photos - localPath 포함 사진 배열
 * @param {Object} options - 옵션
 * @param {boolean} options.useMetadataHint - 메타데이터 힌트 사용 여부 (기본 true)
 * @param {number} options.delayMs - AI 요청 간 지연 시간 (ms)
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, PhaseResult>>} ID별 Phase 결과 맵
 */
export async function classifyPhases(photos, options = {}) {
  const {
    useMetadataHint = true,
    delayMs = 1000,
    onProgress
  } = options;

  const results = new Map();
  const needsAIClassification = [];

  // 1단계: 메타데이터 힌트 적용
  if (useMetadataHint) {
    for (const photo of photos) {
      const hintPhase = extractPhaseFromMetadata(photo);
      if (hintPhase) {
        results.set(photo.id, {
          phase: hintPhase,
          phaseConfidence: 0.7,
          phaseReason: '메타데이터 힌트 (파일명/제목)'
        });
      } else {
        needsAIClassification.push(photo);
      }
    }

    if (onProgress && results.size > 0) {
      onProgress({
        status: 'metadata',
        message: `메타데이터 힌트: ${results.size}장 분류됨`
      });
    }
  } else {
    needsAIClassification.push(...photos);
  }

  // 2단계: AI 분류 (힌트 없는 이미지만)
  if (needsAIClassification.length > 0) {
    if (onProgress) {
      onProgress({
        status: 'ai_start',
        message: `AI 분류 시작: ${needsAIClassification.length}장`
      });
    }

    const aiResults = await extractPhaseBatch(needsAIClassification, {
      delayMs,
      onProgress: (progress) => {
        if (onProgress) {
          onProgress({
            status: 'ai_progress',
            current: progress.current,
            total: progress.total,
            message: `AI 분류 중 (${progress.current}/${progress.total})`
          });
        }
      }
    });

    // AI 결과 병합
    for (const [photoId, phaseResult] of aiResults) {
      results.set(photoId, phaseResult);
    }
  }

  return results;
}

/**
 * Phase 기반 사진 정렬
 * - 신뢰도 >= 임계값: Phase order 순서로 정렬
 * - 신뢰도 < 임계값 또는 unknown: 원본 순서 유지 (뒤쪽 배치)
 * - 동일 Phase 내에서는 기존 순서 유지 (stable sort)
 *
 * @param {Array} photos - 사진 배열 (이미 파일명 정렬됨)
 * @param {Map<string, PhaseResult>} phaseMap - Phase 분류 결과 맵
 * @param {Object} options - 옵션
 * @param {number} options.confidenceThreshold - 신뢰도 임계값 (기본 0.6)
 * @returns {Array} Phase 순서로 정렬된 사진 배열
 */
export function sortByPhase(photos, phaseMap, options = {}) {
  const { confidenceThreshold = PHASE_CONFIDENCE_THRESHOLD } = options;

  // 원본 인덱스 저장 (stable sort를 위해)
  const photosWithIndex = photos.map((photo, index) => {
    const result = phaseMap.get(photo.id);

    // 신뢰도 기반 필터링
    const isLowConfidence = !result ||
                            result.phase === 'unknown' ||
                            result.phaseConfidence < confidenceThreshold;

    return {
      photo,
      originalIndex: index,
      phase: result || { phase: 'unknown', phaseConfidence: 0 },
      useOriginalOrder: isLowConfidence  // 원본 순서 사용 플래그
    };
  });

  // Phase order로 정렬 (신뢰도 기반 필터링 적용)
  photosWithIndex.sort((a, b) => {
    // 둘 다 원본 순서 사용이면 원본 순서 유지
    if (a.useOriginalOrder && b.useOriginalOrder) {
      return a.originalIndex - b.originalIndex;
    }

    // 하나만 원본 순서면 AI 분류 결과 우선 (저신뢰도는 뒤로)
    if (a.useOriginalOrder) return 1;  // a를 뒤로
    if (b.useOriginalOrder) return -1; // b를 뒤로

    // 둘 다 AI 분류된 경우 Phase order로 정렬
    const orderA = WHEEL_RESTORATION_PHASES[a.phase.phase]?.order || 99;
    const orderB = WHEEL_RESTORATION_PHASES[b.phase.phase]?.order || 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 동일 phase: 원본 순서 유지
    return a.originalIndex - b.originalIndex;
  });

  return photosWithIndex.map(item => item.photo);
}

/**
 * Phase 분류 통계 생성
 * @param {Map<string, PhaseResult>} phaseMap - Phase 분류 결과 맵
 * @param {Object} options - 옵션
 * @param {number} options.confidenceThreshold - 신뢰도 임계값 (기본 0.6)
 * @returns {Object} 통계 객체
 */
export function getPhaseStats(phaseMap, options = {}) {
  const { confidenceThreshold = PHASE_CONFIDENCE_THRESHOLD } = options;

  const stats = {
    total: phaseMap.size,
    byPhase: {
      overview: 0,
      before: 0,
      process: 0,
      after: 0,
      unknown: 0
    },
    avgConfidence: 0,
    highConfidenceCount: 0,  // 신뢰도 >= 임계값
    lowConfidenceCount: 0    // 신뢰도 < 임계값 또는 unknown
  };

  let totalConfidence = 0;

  for (const result of phaseMap.values()) {
    const phase = result.phase;
    const confidence = result.phaseConfidence || 0;

    // Phase별 카운트
    if (stats.byPhase.hasOwnProperty(phase)) {
      stats.byPhase[phase]++;
    } else {
      stats.byPhase.unknown++;
    }

    totalConfidence += confidence;

    // 신뢰도 분류
    if (phase !== 'unknown' && confidence >= confidenceThreshold) {
      stats.highConfidenceCount++;
    } else {
      stats.lowConfidenceCount++;
    }
  }

  stats.avgConfidence = stats.total > 0
    ? (totalConfidence / stats.total).toFixed(2)
    : 0;

  return stats;
}

/**
 * Phase 분류 결과 포맷팅 (CLI 출력용)
 * @param {Array} photos - 정렬된 사진 배열
 * @param {Map<string, PhaseResult>} phaseMap - Phase 분류 결과 맵
 * @param {Object} options - 옵션
 * @param {number} options.confidenceThreshold - 신뢰도 임계값 (기본 0.6)
 * @returns {string} 포맷팅된 문자열
 */
export function formatPhaseResults(photos, phaseMap, options = {}) {
  const { confidenceThreshold = PHASE_CONFIDENCE_THRESHOLD } = options;
  const lines = ['', '📊 Phase 분류 결과:', ''];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const result = phaseMap.get(photo.id) || { phase: 'unknown', phaseConfidence: 0 };
    const phaseInfo = WHEEL_RESTORATION_PHASES[result.phase] || { name: '미분류' };
    const confidence = (result.phaseConfidence * 100).toFixed(0);

    // 저신뢰도 표시
    const isLowConfidence = result.phase === 'unknown' || result.phaseConfidence < confidenceThreshold;
    const marker = isLowConfidence ? '⚠️ ' : '';

    lines.push(
      `  [${i + 1}] ${marker}${phaseInfo.name} (${confidence}%) - ${photo.title || photo.image || photo.id}`
    );
  }

  const stats = getPhaseStats(phaseMap, { confidenceThreshold });
  lines.push('');

  // Phase별 통계 (unknown 포함)
  const phaseSummary = [
    `차량 전체 ${stats.byPhase.overview}`,
    `복원 전 ${stats.byPhase.before}`,
    `작업 중 ${stats.byPhase.process}`,
    `복원 후 ${stats.byPhase.after}`
  ];
  if (stats.byPhase.unknown > 0) {
    phaseSummary.push(`미분류 ${stats.byPhase.unknown}`);
  }
  lines.push(`  총 ${stats.total}장: ${phaseSummary.join(', ')}`);

  // 신뢰도 통계
  lines.push(`  AI 분류: ${stats.highConfidenceCount}장, 원본 순서 유지: ${stats.lowConfidenceCount}장`);
  lines.push(`  평균 신뢰도: ${(stats.avgConfidence * 100).toFixed(0)}%`);

  return lines.join('\n');
}

export { WHEEL_RESTORATION_PHASES };
