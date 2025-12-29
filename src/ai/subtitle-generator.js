/**
 * AI 자막 생성 통합 모듈
 *
 * 이미지 분석 → 자막 생성 → 재생 시간 계산을 통합합니다.
 */

import { analyzeImageBatch, isApiKeySet } from './vision.js';
import { calculateDuration, parseReadingSpeed } from '../video/duration-calculator.js';
import { PROMPT_TYPES, QUALITY_LEVELS } from './prompt-templates.js';

/**
 * 사진 배열에 AI 자막과 동적 재생 시간을 추가
 * @param {Array} photos - 사진 배열 (localPath 필수)
 * @param {Object} options - 옵션
 * @param {string} options.promptTemplate - 프롬프트 템플릿
 * @param {string} options.quality - 품질 레벨 (creative|balanced|conservative)
 * @param {string|number} options.readingSpeed - 읽기 속도
 * @param {number} options.minDuration - 최소 재생 시간
 * @param {number} options.maxDuration - 최대 재생 시간
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Array>} AI 자막이 추가된 사진 배열
 */
export async function generateSubtitles(photos, options = {}) {
  const {
    promptTemplate = 'default',
    quality = 'balanced',
    readingSpeed = 250,
    minDuration = 2.0,
    maxDuration = 6.0,
    onProgress
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

  // 진행 상황 래퍼
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

  // AI 분석 실행
  const subtitleMap = await analyzeImageBatch(photos, {
    promptTemplate,
    quality,
    onProgress: progressWrapper
  });

  // 결과 적용
  const enrichedPhotos = photos.map(photo => {
    const aiSubtitle = subtitleMap.get(photo.id);

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
      dynamicDuration
    };
  });

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
