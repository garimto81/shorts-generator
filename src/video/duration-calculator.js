/**
 * 자막 읽기 속도 기반 동적 재생 시간 계산
 *
 * 한글 읽기 속도 기준:
 * - 느린 속도: 200 CPM (분당 글자 수)
 * - 보통 속도: 250 CPM
 * - 빠른 속도: 300 CPM
 */

/**
 * 읽기 속도 프리셋
 */
export const READING_SPEED_PRESETS = {
  slow: { cpm: 200, name: '느린 속도', description: '여유로운 시청' },
  normal: { cpm: 250, name: '보통 속도', description: '일반 시청 (기본)' },
  fast: { cpm: 300, name: '빠른 속도', description: '빠른 전달' }
};

/**
 * 자막 길이 기반 동적 재생 시간 계산
 * @param {string} subtitle - 자막 텍스트
 * @param {Object} options - 설정
 * @param {number} options.readingSpeed - 분당 글자 수 (CPM), 기본 250
 * @param {number} options.minDuration - 최소 재생 시간 (초), 기본 2.0
 * @param {number} options.maxDuration - 최대 재생 시간 (초), 기본 6.0
 * @param {number} options.bufferTime - 읽기 완료 후 여유 시간 (초), 기본 0.5
 * @returns {number} 재생 시간 (초)
 */
export function calculateDuration(subtitle, options = {}) {
  const {
    readingSpeed = 250,
    minDuration = 2.0,
    maxDuration = 6.0,
    bufferTime = 0.5
  } = options;

  // 자막이 없으면 최소 시간 반환
  if (!subtitle || subtitle.length === 0) {
    return minDuration;
  }

  // 글자 수 계산 (공백, 줄바꿈 제외)
  const charCount = subtitle.replace(/[\s\n]/g, '').length;

  // 초당 글자 수 = CPM / 60
  const charsPerSecond = readingSpeed / 60;

  // 기본 소요 시간 + 버퍼
  const baseDuration = (charCount / charsPerSecond) + bufferTime;

  // 최소/최대 범위 적용 후 소수점 1자리로 반올림
  const clampedDuration = Math.min(maxDuration, Math.max(minDuration, baseDuration));
  return Math.round(clampedDuration * 10) / 10;
}

/**
 * 읽기 속도 문자열을 CPM 값으로 변환
 * @param {string|number} speed - 'slow', 'normal', 'fast' 또는 CPM 숫자
 * @returns {number} CPM 값
 */
export function parseReadingSpeed(speed) {
  if (typeof speed === 'number') {
    return speed;
  }

  const preset = READING_SPEED_PRESETS[speed.toLowerCase()];
  if (preset) {
    return preset.cpm;
  }

  // 숫자 문자열인 경우
  const parsed = parseInt(speed, 10);
  if (!isNaN(parsed)) {
    return parsed;
  }

  // 기본값
  return READING_SPEED_PRESETS.normal.cpm;
}
