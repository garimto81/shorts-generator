export const SUBTITLE_STYLE = {
  fontSize: 60,
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 2,
  position: { y: 0.85 }
};

/**
 * 자막 텍스트를 적절한 줄바꿈으로 포맷
 * 띄어쓰기 기반 단어 분리 우선, 긴 단어만 글자 분리
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 줄당 최대 글자 수 (기본 15)
 * @param {Object} options - 추가 옵션
 * @returns {string} 줄바꿈이 적용된 텍스트
 */
export function formatSubtitle(text, maxLength = 15, options = {}) {
  const { balanceLines = true } = options;

  if (!text || text.length <= maxLength) return text || '';

  // 띄어쓰기 기반 단어 분리
  const words = text.split(/\s+/).filter(w => w.length > 0);

  // 단어가 없으면 글자 단위 분리 (폴백)
  if (words.length === 0) {
    return splitByCharacter(text, maxLength);
  }

  // 단어를 줄에 배치 (greedy 알고리즘)
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    // 단어 자체가 maxLength 초과 시 글자 단위 분리
    if (word.length > maxLength) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(...splitLongWord(word, maxLength));
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // 2줄일 경우 줄 밸런싱 (선택적)
  if (balanceLines && lines.length === 2) {
    const balanced = balanceTwoLines(text, maxLength);
    if (balanced) return balanced;
  }

  return lines.join('\n');
}

/**
 * 긴 단어를 글자 단위로 분리
 * @param {string} word - 분리할 단어
 * @param {number} maxLength - 최대 길이
 * @returns {string[]} 분리된 청크 배열
 */
function splitLongWord(word, maxLength) {
  const chunks = [];
  for (let i = 0; i < word.length; i += maxLength) {
    chunks.push(word.slice(i, i + maxLength));
  }
  return chunks;
}

/**
 * 글자 단위로 분리 (폴백)
 * @param {string} text - 분리할 텍스트
 * @param {number} maxLength - 최대 길이
 * @returns {string} 줄바꿈된 텍스트
 */
function splitByCharacter(text, maxLength) {
  const lines = [];
  let current = '';

  for (const char of text) {
    if (current.length >= maxLength) {
      lines.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) lines.push(current);

  return lines.join('\n');
}

/**
 * 두 줄을 균형있게 분배
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 줄당 최대 길이
 * @returns {string|null} 밸런싱된 텍스트 또는 null
 */
function balanceTwoLines(text, maxLength) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return null;

  // 모든 분할 지점을 시도하여 가장 균형잡힌 분할 찾기
  let bestSplit = null;
  let bestDiff = Infinity;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(' ');
    const line2 = words.slice(i).join(' ');

    // 두 줄 모두 maxLength 이내인지 확인
    if (line1.length <= maxLength && line2.length <= maxLength) {
      const diff = Math.abs(line1.length - line2.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSplit = `${line1}\n${line2}`;
      }
    }
  }

  return bestSplit;
}
