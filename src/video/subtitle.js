/**
 * Subtitle formatting module for Shorts Generator
 * Issue #23: 자막 퀄리티 종합 개선
 */

export const SUBTITLE_STYLE = {
  fontSize: 60,
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 2,
  position: { y: 0.85 }
};

/**
 * 한글 조사 목록 (분리 방지 대상)
 * 순서: 긴 조사 → 짧은 조사 (매칭 우선순위)
 */
export const KOREAN_PARTICLES = [
  // 3글자 조사
  '에서는', '으로는', '에서도', '으로도', '까지는', '부터는',
  // 2글자 조사
  '에서', '으로', '까지', '부터', '에게', '한테', '처럼', '같이', '보다', '마다',
  // 1글자 조사
  '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만', '나', '고'
];

/**
 * 한글 조사가 다음 줄로 분리되지 않도록 방지
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 줄당 최대 글자 수
 * @returns {string} 조사 분리가 방지된 텍스트
 */
export function preventParticleSeparation(text, maxLength) {
  if (!text) return text;
  if (text.length <= maxLength) return text;

  // 띄어쓰기 기반 단어 분리
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return text;

  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    // 다음 단어가 조사로 시작하는지 확인
    const nextStartsWithParticle = nextWord && isParticle(nextWord);

    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      // 현재 줄을 저장하고 새 줄 시작
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }

    // 다음 단어가 조사이고 현재 줄에 공간이 있으면 같이 넣기
    if (nextStartsWithParticle && currentLine.length + 1 + nextWord.length <= maxLength) {
      // 조사를 현재 단어와 붙여서 처리
      currentLine += ' ' + nextWord;
      i++; // 다음 단어 스킵
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

/**
 * 단어가 한글 조사인지 확인
 * @param {string} word - 확인할 단어
 * @returns {boolean}
 */
function isParticle(word) {
  if (!word) return false;
  // 단어가 조사 자체이거나 조사로 시작하는지 확인
  return KOREAN_PARTICLES.some(p => word === p || word.startsWith(p));
}

/**
 * 텍스트 길이에 따른 동적 폰트 크기 계산
 * @param {string} text - 자막 텍스트
 * @param {Object} options - 설정 옵션
 * @param {number} options.baseSize - 기본 폰트 크기 (default: 60)
 * @param {number} options.minSize - 최소 폰트 크기 (default: 40)
 * @param {number} options.maxLength - 크기 감소 시작 길이 (default: 15)
 * @returns {number} 계산된 폰트 크기
 */
export function calculateDynamicFontSize(text, options = {}) {
  const {
    baseSize = 60,
    minSize = 40,
    maxLength = 15
  } = options;

  if (!text || text.length === 0) return baseSize;

  const length = text.length;

  // 짧은 텍스트는 기본 크기
  if (length <= maxLength) return baseSize;

  // 길이에 따라 점진적으로 크기 감소
  // 15자 초과 시 글자당 0.5씩 감소, 최소 크기까지
  const reduction = Math.floor((length - maxLength) * 0.5);
  const calculatedSize = baseSize - reduction;

  return Math.max(calculatedSize, minSize);
}

/**
 * 의미 단위(구두점) 기준으로 줄바꿈
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 줄당 최대 글자 수
 * @param {Object} options - 추가 옵션
 * @param {number} options.maxLines - 최대 줄 수 (default: 3)
 * @returns {string} 의미 단위로 분리된 텍스트
 */
export function splitAtMeaningfulBoundary(text, maxLength, options = {}) {
  if (!text) return text;
  if (text.length <= maxLength) return text;

  const { maxLines = 3 } = options;

  // 구두점 패턴: 쉼표, 마침표, 느낌표, 물음표
  const punctuationPattern = /([,.\uFF0C\uFF0E!?\uFF01\uFF1F])\s*/g;

  // 구두점 기준으로 분리 시도
  const segments = [];
  let lastIndex = 0;
  let match;

  punctuationPattern.lastIndex = 0;
  while ((match = punctuationPattern.exec(text)) !== null) {
    const segment = text.slice(lastIndex, match.index + match[1].length);
    if (segment.trim()) {
      segments.push(segment.trim());
    }
    lastIndex = match.index + match[0].length;
  }

  // 마지막 부분 추가
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    segments.push(remaining);
  }

  // 세그먼트가 없으면 단어 기반으로 폴백
  if (segments.length <= 1) {
    return formatSubtitleInternal(text, maxLength, { preventParticleSplit: true });
  }

  // 세그먼트를 줄로 조합
  const lines = [];
  let currentLine = '';

  for (const segment of segments) {
    const testLine = currentLine ? `${currentLine} ${segment}` : segment;

    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // 세그먼트 자체가 너무 길면 분리
      if (segment.length > maxLength) {
        const subLines = formatSubtitleInternal(segment, maxLength, { preventParticleSplit: true }).split('\n');
        lines.push(...subLines.slice(0, maxLines - lines.length));
        currentLine = '';
      } else {
        currentLine = segment;
      }
    }

    // 최대 줄 수 체크
    if (lines.length >= maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines).join('\n');
}

/**
 * 내부 포맷팅 함수 (순환 참조 방지)
 */
function formatSubtitleInternal(text, maxLength, options = {}) {
  const { preventParticleSplit = false } = options;

  if (!text || text.length <= maxLength) return text || '';

  if (preventParticleSplit) {
    return preventParticleSeparation(text, maxLength);
  }

  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return text;

  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

/**
 * 자막 텍스트를 적절한 줄바꿈으로 포맷
 * 띄어쓰기 기반 단어 분리 우선, 긴 단어만 글자 분리
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 줄당 최대 글자 수 (기본 15)
 * @param {Object} options - 추가 옵션
 * @param {boolean} options.balanceLines - 2줄 밸런싱 (default: true)
 * @param {boolean} options.preventParticleSplit - 조사 분리 방지 (default: false)
 * @returns {string} 줄바꿈이 적용된 텍스트
 */
export function formatSubtitle(text, maxLength = 15, options = {}) {
  const {
    balanceLines = true,
    preventParticleSplit = false
  } = options;

  if (!text || text.length <= maxLength) return text || '';

  // 조사 분리 방지 옵션이 활성화된 경우
  if (preventParticleSplit) {
    return preventParticleSeparation(text, maxLength);
  }

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
