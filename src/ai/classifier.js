/**
 * 이미지 분류 및 특징 추출 모듈
 *
 * 휠복원 전담 앱을 위한 이미지 분류 시스템
 * - 하이브리드 분류: 메타데이터 → 캐시 → AI
 * - 2단계 분석: 특징 추출 → 맞춤 자막 생성
 */

import { extractFeaturesBatch } from './vision.js';
import { fetchPhotoCategories, updatePhotoCategories } from '../api/pocketbase.js';

/**
 * 휠복원 앱 카테고리 정의
 */
export const CATEGORIES = {
  wheelRestoration: 'wheelRestoration', // 휠 복원 완료, 광택, 도색
  beforeAfter: 'beforeAfter',           // 전/후 비교
  process: 'process',                   // 작업 과정
  default: 'default'                    // 기타
};

/**
 * 카테고리별 키워드 매핑 (메타데이터 분류용)
 */
export const CATEGORY_KEYWORDS = {
  wheelRestoration: [
    '휠', 'wheel', '복원', 'CNC', '도색', '광택', '폴리싱',
    '완료', 'complete', 'finish', '결과', 'result'
  ],
  beforeAfter: [
    '전후', 'before', 'after', '비교', '변화', '전/후', '이전'
  ],
  process: [
    '과정', 'process', '작업', '공정', '세척', '가공', '중',
    'working', 'cleaning', '진행'
  ]
};

/**
 * 신뢰도 임계값
 */
export const CONFIDENCE_THRESHOLDS = {
  metadata: 0.7,  // 메타데이터 분류 최소 신뢰도
  cache: 0.8,     // 캐시된 결과 신뢰도
  ai: 0.6,        // AI 분류 최소 신뢰도
  fallback: 0.5   // fallback 시 기본 신뢰도
};

/**
 * @typedef {Object} ClassificationResult
 * @property {string} photoId - 사진 ID
 * @property {string} category - 분류된 카테고리
 * @property {string[]} features - 추출된 특징 배열
 * @property {string} mainSubject - 주요 피사체
 * @property {number} confidence - 신뢰도 (0.0-1.0)
 * @property {string} source - 분류 출처 (metadata|cache|ai)
 * @property {string} [reason] - 분류 근거
 */

/**
 * 메타데이터(그룹명, 파일명)로 카테고리 분류
 * @param {Object} photo - 사진 객체
 * @param {string} photo.id - 사진 ID
 * @param {string} [photo.groupTitle] - 그룹 제목
 * @param {string} [photo.image] - 파일명
 * @param {string} [photo.title] - 사진 제목
 * @returns {ClassificationResult|null} 분류 결과 또는 null
 */
export function classifyByMetadata(photo) {
  const searchText = [
    photo.groupTitle || '',
    photo.image || '',
    photo.title || ''
  ].join(' ').toLowerCase();

  if (!searchText.trim()) {
    return null;
  }

  // 각 카테고리별 키워드 매칭 점수 계산
  const scores = {};
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matchedKeywords = keywords.filter(kw =>
      searchText.includes(kw.toLowerCase())
    );
    scores[category] = matchedKeywords.length;
  }

  // 가장 높은 점수의 카테고리 선택
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return null;
  }

  const bestCategory = Object.entries(scores)
    .find(([, score]) => score === maxScore)?.[0];

  if (!bestCategory) {
    return null;
  }

  // 신뢰도 계산: 매칭된 키워드 수에 비례 (최대 0.9)
  const confidence = Math.min(0.5 + (maxScore * 0.15), 0.9);

  if (confidence < CONFIDENCE_THRESHOLDS.metadata) {
    return null;
  }

  return {
    photoId: photo.id,
    category: bestCategory,
    features: [],
    mainSubject: '',
    confidence,
    source: 'metadata',
    reason: `키워드 매칭: ${searchText.substring(0, 50)}...`
  };
}

/**
 * PocketBase 캐시에서 분류 결과 조회
 * @param {string[]} photoIds - 사진 ID 배열
 * @returns {Promise<Map<string, ClassificationResult>>} ID별 분류 결과 맵
 */
export async function checkCache(photoIds) {
  const results = new Map();

  try {
    const cached = await fetchPhotoCategories(photoIds);

    for (const item of cached) {
      if (item.aiCategory) {
        results.set(item.id, {
          photoId: item.id,
          category: item.aiCategory,
          features: item.aiFeatures || [],
          mainSubject: item.aiMainSubject || '',
          confidence: item.aiCategoryConfidence || CONFIDENCE_THRESHOLDS.cache,
          source: 'cache',
          reason: '캐시된 결과'
        });
      }
    }
  } catch (error) {
    console.warn('캐시 조회 실패:', error.message);
  }

  return results;
}

/**
 * 분류 결과를 PocketBase에 저장
 * @param {ClassificationResult[]} results - 분류 결과 배열
 * @returns {Promise<void>}
 */
export async function saveToCache(results) {
  if (!results || results.length === 0) return;

  try {
    const updates = results
      .filter(r => r.source === 'ai') // AI 분류 결과만 캐싱
      .map(r => ({
        id: r.photoId,
        aiCategory: r.category,
        aiFeatures: r.features,
        aiMainSubject: r.mainSubject,
        aiCategoryConfidence: r.confidence,
        aiCategorySource: r.source
      }));

    if (updates.length > 0) {
      await updatePhotoCategories(updates);
    }
  } catch (error) {
    // 캐시 저장 실패는 비차단 - 경고만 출력
    console.warn('캐시 저장 실패 (무시됨):', error.message);
  }
}

/**
 * AI로 이미지 특징 추출 및 분류 (배치)
 * @param {Array<{id: string, localPath: string}>} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, ClassificationResult>>} ID별 분류 결과 맵
 */
export async function classifyByAI(photos, options = {}) {
  const { onProgress } = options;
  const results = new Map();

  if (!photos || photos.length === 0) {
    return results;
  }

  try {
    // AI 특징 추출 (배치)
    const aiResults = await extractFeaturesBatch(photos, {
      onProgress
    });

    for (const [photoId, analysis] of aiResults) {
      if (analysis) {
        results.set(photoId, {
          photoId,
          category: analysis.category || CATEGORIES.default,
          features: analysis.features || [],
          mainSubject: analysis.mainSubject || '',
          confidence: analysis.confidence || CONFIDENCE_THRESHOLDS.ai,
          source: 'ai',
          reason: analysis.reason || 'AI 분석'
        });
      } else {
        // AI 분석 실패 시 기본값
        results.set(photoId, {
          photoId,
          category: CATEGORIES.default,
          features: [],
          mainSubject: '',
          confidence: CONFIDENCE_THRESHOLDS.fallback,
          source: 'ai',
          reason: 'AI 분석 실패, 기본값 사용'
        });
      }
    }
  } catch (error) {
    console.warn('AI 분류 실패:', error.message);
    // 모든 사진에 기본값 적용
    for (const photo of photos) {
      results.set(photo.id, {
        photoId: photo.id,
        category: CATEGORIES.default,
        features: [],
        mainSubject: '',
        confidence: CONFIDENCE_THRESHOLDS.fallback,
        source: 'ai',
        reason: `AI 분류 실패: ${error.message}`
      });
    }
  }

  return results;
}

/**
 * 통합 이미지 분류 (하이브리드)
 *
 * 분류 순서:
 * 1. 메타데이터 분류 (그룹명/파일명)
 * 2. PocketBase 캐시 확인
 * 3. 불확실한 이미지만 AI 분류
 * 4. 결과 캐싱
 *
 * @param {Array<{id: string, localPath: string, groupTitle?: string, image?: string, title?: string}>} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {boolean} options.skipCache - 캐시 건너뛰기
 * @param {boolean} options.forceAI - 강제 AI 분류
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, ClassificationResult>>} ID별 분류 결과 맵
 */
export async function classifyImages(photos, options = {}) {
  const {
    skipCache = false,
    forceAI = false,
    onProgress
  } = options;

  const results = new Map();
  const needsAIClassification = [];

  // 1단계: 메타데이터 분류 (forceAI가 아닐 때만)
  if (!forceAI) {
    for (const photo of photos) {
      const metadataResult = classifyByMetadata(photo);
      if (metadataResult && metadataResult.confidence >= CONFIDENCE_THRESHOLDS.metadata) {
        results.set(photo.id, metadataResult);
      } else {
        needsAIClassification.push(photo);
      }
    }

    if (onProgress && results.size > 0) {
      onProgress(`메타데이터 분류: ${results.size}장 완료`);
    }
  } else {
    needsAIClassification.push(...photos);
  }

  // 2단계: 캐시 확인 (skipCache가 아닐 때만)
  if (!skipCache && needsAIClassification.length > 0) {
    const photoIds = needsAIClassification.map(p => p.id);
    const cachedResults = await checkCache(photoIds);

    for (const [photoId, result] of cachedResults) {
      results.set(photoId, result);
    }

    // 캐시에서 찾은 사진 제외
    const stillNeeds = needsAIClassification.filter(p => !cachedResults.has(p.id));
    needsAIClassification.length = 0;
    needsAIClassification.push(...stillNeeds);

    if (onProgress && cachedResults.size > 0) {
      onProgress(`캐시 조회: ${cachedResults.size}장 사용`);
    }
  }

  // 3단계: AI 분류 (남은 이미지)
  if (needsAIClassification.length > 0) {
    if (onProgress) {
      onProgress(`AI 분류 시작: ${needsAIClassification.length}장`);
    }

    const aiResults = await classifyByAI(needsAIClassification, { onProgress });

    for (const [photoId, result] of aiResults) {
      results.set(photoId, result);
    }

    // 4단계: AI 결과 캐싱
    const aiResultsArray = Array.from(aiResults.values());
    await saveToCache(aiResultsArray);
  }

  return results;
}

/**
 * 분류 결과를 카테고리별로 그룹화
 * @param {Map<string, ClassificationResult>} classificationMap - 분류 결과 맵
 * @param {Array} photos - 원본 사진 배열
 * @returns {Object<string, Array>} 카테고리별 사진 배열
 */
export function groupByCategory(classificationMap, photos) {
  const groups = {};

  for (const photo of photos) {
    const result = classificationMap.get(photo.id);
    const category = result?.category || CATEGORIES.default;

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push({
      ...photo,
      classification: result
    });
  }

  return groups;
}

/**
 * 분류 통계 생성
 * @param {Map<string, ClassificationResult>} classificationMap - 분류 결과 맵
 * @returns {Object} 통계 객체
 */
export function getClassificationStats(classificationMap) {
  const stats = {
    total: classificationMap.size,
    byCategory: {},
    bySource: {
      metadata: 0,
      cache: 0,
      ai: 0
    },
    avgConfidence: 0
  };

  let totalConfidence = 0;

  for (const result of classificationMap.values()) {
    // 카테고리별 카운트
    stats.byCategory[result.category] = (stats.byCategory[result.category] || 0) + 1;

    // 소스별 카운트
    stats.bySource[result.source] = (stats.bySource[result.source] || 0) + 1;

    // 신뢰도 합계
    totalConfidence += result.confidence;
  }

  stats.avgConfidence = stats.total > 0
    ? (totalConfidence / stats.total).toFixed(2)
    : 0;

  return stats;
}
