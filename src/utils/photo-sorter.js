/**
 * 사진 정렬 유틸리티
 * 파일명 패턴을 분석하여 원본 순서대로 정렬
 */

/**
 * 정렬 모드 정의
 */
export const SORT_MODES = {
  filename: {
    name: 'filename',
    description: '파일명에서 순번 추출하여 정렬'
  },
  created: {
    name: 'created',
    description: '업로드 시간순 정렬'
  },
  none: {
    name: 'none',
    description: '정렬 없음 (API 반환 순서)'
  }
};

/**
 * 파일명에서 정렬 키 추출
 *
 * 지원 패턴:
 * - 카카오톡: kakao_talk_YYYYMMDD_HHMMSSMMM_XX_hash.jpg → XX (01-99)
 * - iPhone IMG: img_NNNN_hash.jpg → NNNN
 * - 일반: 첫 번째 연속 숫자
 *
 * @param {string} filename - 파일명
 * @returns {number|string} - 정렬 키 (숫자 우선, 없으면 문자열)
 */
export function extractSortKey(filename) {
  if (!filename) return Infinity;

  // 1. 카카오톡 패턴: kakao_talk_YYYYMMDD_HHMMSSMMM_XX_*.jpg
  // 예: kakao_talk_20251229_184022484_01_6wa37nkaqv.jpg
  const kakaoMatch = filename.match(/kakao_talk_\d+_\d+_(\d{2})_/i);
  if (kakaoMatch) {
    return parseInt(kakaoMatch[1], 10);
  }

  // 2. IMG 패턴: img_NNNN_*.jpg
  // 예: img_4235_0jli6sszed.jpg
  const imgMatch = filename.match(/img_(\d+)_/i);
  if (imgMatch) {
    return parseInt(imgMatch[1], 10);
  }

  // 3. 일반 숫자 패턴: 파일명 내 첫 번째 연속 숫자
  const numMatch = filename.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  // 4. Fallback: 파일명 알파벳순 (소문자 변환)
  return filename.toLowerCase();
}

/**
 * 사진 배열 정렬
 *
 * @param {Array} photos - 사진 객체 배열 ({ image, ... })
 * @param {string} sortBy - 정렬 기준 (filename|created|none)
 * @returns {Array} - 정렬된 배열 (원본 배열 불변)
 */
export function sortPhotos(photos, sortBy = 'filename') {
  // null/undefined 처리
  if (!photos) {
    return photos;
  }

  // 빈 배열 또는 정렬 없음
  if (!photos.length || sortBy === 'none') {
    return sortBy === 'none' ? [...photos] : photos;
  }

  return [...photos].sort((a, b) => {
    if (sortBy === 'filename') {
      const keyA = extractSortKey(a.image);
      const keyB = extractSortKey(b.image);

      // 숫자 vs 숫자
      if (typeof keyA === 'number' && typeof keyB === 'number') {
        return keyA - keyB;
      }
      // 숫자 vs 문자열 (숫자 우선)
      if (typeof keyA === 'number') return -1;
      if (typeof keyB === 'number') return 1;
      // 문자열 vs 문자열
      return String(keyA).localeCompare(String(keyB));
    }

    if (sortBy === 'created') {
      // created 필드가 없을 수 있음 (PocketHost 제한)
      const dateA = a.created || a.updated || '';
      const dateB = b.created || b.updated || '';
      return String(dateA).localeCompare(String(dateB));
    }

    return 0;
  });
}
