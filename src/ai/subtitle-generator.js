/**
 * AI 자막 생성 통합 모듈
 *
 * 이미지 분석 → 자막 생성 → 재생 시간 계산을 통합합니다.
 *
 * v2.0: Few-Shot Examples Library 지원
 * - 외부 JSON 예시 파일 사용 가능
 * - 스타일 가이드 적용
 *
 * v3.0: 2단계 분석 시스템
 * - 이미지 특징 추출 → 맞춤 자막 생성
 * - 자동 분류 (메타데이터 → 캐시 → AI)
 */

import { analyzeImageBatch, analyzeImageBatchTwoStep, isApiKeySet, extractPhaseBatch } from './vision.js';
import { calculateDuration, parseReadingSpeed } from '../video/duration-calculator.js';
import { PROMPT_TYPES, QUALITY_LEVELS, getAvailableExamples } from './prompt-templates.js';
import {
  classifyImages,
  groupByCategory,
  getClassificationStats,
  CATEGORIES
} from './classifier.js';

/**
 * 사진 배열에 AI 자막과 동적 재생 시간을 추가
 * @param {Array} photos - 사진 배열 (localPath 필수)
 * @param {Object} options - 옵션
 * @param {string} options.promptTemplate - 프롬프트 템플릿
 * @param {string} options.quality - 품질 레벨 (creative|balanced|conservative)
 * @param {string} options.customExamplesPath - 커스텀 예시 파일 경로 (v2.0)
 * @param {string|number} options.readingSpeed - 읽기 속도
 * @param {number} options.minDuration - 최소 재생 시간
 * @param {number} options.maxDuration - 최대 재생 시간
 * @param {boolean} options.autoClassify - 자동 분류 활성화 (v3.0)
 * @param {boolean} options.twoStepAnalysis - 2단계 분석 활성화 (v3.0)
 * @param {boolean} options.showClassification - 분류 결과 표시 (v3.0)
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Array>} AI 자막이 추가된 사진 배열
 */
export async function generateSubtitles(photos, options = {}) {
  const {
    promptTemplate = 'default',
    quality = 'balanced',
    customExamplesPath = null,
    readingSpeed = 250,
    minDuration = 2.0,
    maxDuration = 6.0,
    autoClassify = false,
    twoStepAnalysis = false,
    showClassification = false,
    onProgress,
    // P1: Phase 정보 (외부에서 전달 또는 내부 생성)
    phaseMap = null,
    // P0+P1: Phase 기반 컨텍스트 자막 활성화 (--ai-sort 사용 시만 true)
    usePhaseContext = false
  } = options;

  // API 키 확인
  if (!isApiKeySet()) {
    throw new Error(
      'AI 자막 생성을 위해 GOOGLE_API_KEY 환경변수를 설정해주세요.\n' +
      'API 키 발급: https://aistudio.google.com/apikey'
    );
  }

  // 읽기 속도 파싱
  const cpm = parseReadingSpeed(readingSpeed);

  // v3.0: 자동 분류 또는 2단계 분석 모드
  if (autoClassify || twoStepAnalysis) {
    return await generateSubtitlesTwoStep(photos, {
      quality,
      readingSpeed: cpm,
      minDuration,
      maxDuration,
      showClassification,
      onProgress,
      phaseMap  // P1: Phase 맵 전달
    });
  }

  // P0+P1: Phase 맵이 없고 컨텍스트가 활성화되어 있으면 Phase 분류 실행
  let finalPhaseMap = phaseMap;
  if (usePhaseContext && !finalPhaseMap && photos.length > 1) {
    if (onProgress) {
      onProgress('🔍 Phase 분류 중...');
    }
    try {
      finalPhaseMap = await extractPhaseBatch(photos, {
        onProgress: onProgress ? (info) => {
          if (info.status === 'classifying') {
            onProgress(`  [${info.current}/${info.total}] Phase 분류 중...`);
          }
        } : undefined
      });
      if (onProgress) {
        onProgress('✅ Phase 분류 완료');
      }
    } catch (error) {
      console.warn('Phase 분류 실패, 컨텍스트 없이 진행:', error.message);
      finalPhaseMap = new Map();
    }
  }

  // 기존 방식 (v2.0): 단일 프롬프트로 분석
  // v3.2: P0+P1+P2 배치 컨텍스트 및 Phase 정보 전달
  const progressWrapper = onProgress
    ? (info) => {
        const { current, total, photoId, status, subtitle } = info;
        if (status === 'analyzing') {
          onProgress(`  [${current}/${total}] 이미지 분석 중...`);
        } else if (status === 'done') {
          onProgress(`  [${current}/${total}] "${subtitle}" 생성됨`);
        } else if (status === 'error') {
          onProgress(`  [${current}/${total}] 분석 실패 (${photoId})`);
        }
      }
    : undefined;

  // AI 분석 실행 (P0+P1+P2: Phase 맵 전달)
  const subtitleMap = await analyzeImageBatch(photos, {
    promptTemplate,
    quality,
    customExamplesPath,
    onProgress: progressWrapper,
    phaseMap: finalPhaseMap || new Map()  // P1: Phase 정보 전달
  });

  // 결과 적용
  const enrichedPhotos = photos.map(photo => {
    const aiSubtitle = subtitleMap.get(photo.id);
    const phaseInfo = finalPhaseMap?.get(photo.id);

    // 자막 우선순위: AI 생성 > 원본 title > 그룹명
    const finalSubtitle = aiSubtitle || photo.title || photo.groupTitle || '';

    // 동적 재생 시간 계산
    const dynamicDuration = calculateDuration(finalSubtitle, {
      readingSpeed: cpm,
      minDuration,
      maxDuration
    });

    return {
      ...photo,
      aiSubtitle,
      finalSubtitle,
      dynamicDuration,
      // P1: Phase 정보 추가
      phase: phaseInfo?.phase || null
    };
  });

  return enrichedPhotos;
}

/**
 * v3.0: 2단계 분석으로 자막 생성
 * 1단계: 이미지 특징 추출 + 분류
 * 2단계: 특징 기반 맞춤 자막 생성
 *
 * @param {Array} photos - 사진 배열
 * @param {Object} options - 옵션
 * @returns {Promise<Array>} AI 자막이 추가된 사진 배열
 */
async function generateSubtitlesTwoStep(photos, options = {}) {
  const {
    quality = 'balanced',
    readingSpeed = 250,
    minDuration = 2.0,
    maxDuration = 6.0,
    showClassification = false,
    onProgress,
    // P1: Phase 맵 (외부에서 전달)
    phaseMap = null
  } = options;

  if (onProgress) {
    onProgress('🔍 2단계 AI 분석 시작...');
  }

  // 1단계: 이미지 분류 및 특징 추출
  if (onProgress) {
    onProgress('  [1/2] 이미지 분류 및 특징 추출 중...');
  }

  const classificationMap = await classifyImages(photos, {
    onProgress: showClassification ? (msg) => onProgress(`    ${msg}`) : undefined
  });

  // 분류 통계 출력
  if (showClassification && onProgress) {
    const stats = getClassificationStats(classificationMap);
    onProgress(`  📊 분류 결과: ${stats.total}장`);
    for (const [category, count] of Object.entries(stats.byCategory)) {
      const percent = ((count / stats.total) * 100).toFixed(0);
      onProgress(`     • ${category}: ${count}장 (${percent}%)`);
    }
    onProgress(`     평균 신뢰도: ${stats.avgConfidence}`);
  }

  // 2단계: 특징 기반 맞춤 자막 생성
  if (onProgress) {
    onProgress('  [2/2] 특징 기반 맞춤 자막 생성 중...');
  }

  // 분류 결과를 preExtractedFeatures로 변환
  const preExtractedFeatures = new Map();
  for (const [photoId, result] of classificationMap) {
    preExtractedFeatures.set(photoId, {
      category: result.category,
      mainSubject: result.mainSubject,
      features: result.features,
      confidence: result.confidence
    });
  }

  // 2단계 분석 실행
  const progressWrapper = onProgress
    ? (info) => {
        const { current, total, status, subtitle, category } = info;
        if (status === 'analyzing') {
          onProgress(`    [${current}/${total}] 자막 생성 중...`);
        } else if (status === 'done') {
          const categoryLabel = category || 'default';
          onProgress(`    [${current}/${total}] [${categoryLabel}] "${subtitle}"`);
        } else if (status === 'error') {
          onProgress(`    [${current}/${total}] 생성 실패`);
        }
      }
    : undefined;

  const resultsMap = await analyzeImageBatchTwoStep(photos, {
    preExtractedFeatures,
    onProgress: progressWrapper
  });

  // 결과 적용
  const enrichedPhotos = photos.map(photo => {
    const result = resultsMap.get(photo.id);
    const classification = classificationMap.get(photo.id);

    const aiSubtitle = result?.subtitle || null;
    const finalSubtitle = aiSubtitle || photo.title || photo.groupTitle || '';

    // 동적 재생 시간 계산
    const dynamicDuration = calculateDuration(finalSubtitle, {
      readingSpeed,
      minDuration,
      maxDuration
    });

    return {
      ...photo,
      aiSubtitle,
      finalSubtitle,
      dynamicDuration,
      // v3.0 추가 정보
      classification: classification ? {
        category: classification.category,
        features: classification.features,
        mainSubject: classification.mainSubject,
        confidence: classification.confidence,
        source: classification.source
      } : null
    };
  });

  if (onProgress) {
    onProgress('✅ 2단계 AI 분석 완료');
  }

  return enrichedPhotos;
}

/**
 * AI 자막 기능 사용 가능 여부 확인
 * @returns {{available: boolean, reason?: string}}
 */
export function checkAvailability() {
  if (!isApiKeySet()) {
    return {
      available: false,
      reason: 'GOOGLE_API_KEY 환경변수가 설정되지 않음'
    };
  }

  return { available: true };
}

/**
 * 사용 가능한 프롬프트 템플릿 목록
 */
export { PROMPT_TYPES };

/**
 * 사용 가능한 품질 레벨 목록
 */
export { QUALITY_LEVELS };

/**
 * 예시 템플릿 정보 조회
 */
export { getAvailableExamples };
