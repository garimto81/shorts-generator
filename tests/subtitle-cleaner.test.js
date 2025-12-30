/**
 * AI 자막 클리닝 테스트
 * Node.js 내장 테스트 러너 사용 (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// cleanSubtitle 함수를 직접 테스트하기 위해 임시로 복사
// (실제로는 vision.js에서 export하지 않으므로)
function cleanSubtitle(text) {
  if (!text) return text;

  // 1. 여러 선택지가 있는 경우 첫 번째 따옴표 안의 내용만 추출
  const quotedMatches = text.match(/"([^"]+)"/g);
  if (quotedMatches && quotedMatches.length >= 1) {
    text = quotedMatches[0].replace(/^"|"$/g, '');
  }

  let cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/선택\s*\d+[:\s]*/gi, '')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/^["'「」『』]+|["'「」『』]+$/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

describe('cleanSubtitle', () => {
  describe('마크다운 제거', () => {
    it('should remove **bold** markdown', () => {
      const input = '**새 휠로 다시 태어나다**';
      assert.equal(cleanSubtitle(input), '새 휠로 다시 태어나다');
    });

    it('should remove *italic* markdown', () => {
      const input = '*완벽한 휠 복원*';
      assert.equal(cleanSubtitle(input), '완벽한 휠 복원');
    });

    it('should remove mixed markdown', () => {
      const input = '**장인의 손길**, *휠 복원의 가치*';
      assert.equal(cleanSubtitle(input), '장인의 손길, 휠 복원의 가치');
    });
  });

  describe('선택지 형식 제거', () => {
    it('should remove 선택 1: prefix', () => {
      const input = '선택 1: 낡은 휠, 명품으로 부활';
      assert.equal(cleanSubtitle(input), '낡은 휠, 명품으로 부활');
    });

    it('should remove 선택1: prefix (no space)', () => {
      const input = '선택1: 휠 복원의 가치';
      assert.equal(cleanSubtitle(input), '휠 복원의 가치');
    });

    it('should handle multiple 선택 options', () => {
      const input = '**선택 1:** "낡은 휠, 명품으로 부활" **선택 2:** "휠 복원"';
      const result = cleanSubtitle(input);
      assert.equal(result, '낡은 휠, 명품으로 부활');
    });
  });

  describe('따옴표 제거', () => {
    it('should remove surrounding quotes', () => {
      const input = '"완벽한 휠 복원"';
      assert.equal(cleanSubtitle(input), '완벽한 휠 복원');
    });

    it('should remove single quotes', () => {
      const input = "'휠 복원의 가치'";
      assert.equal(cleanSubtitle(input), '휠 복원의 가치');
    });

    it('should remove Korean quotes', () => {
      const input = '「완벽한 휠」';
      assert.equal(cleanSubtitle(input), '완벽한 휠');
    });
  });

  describe('줄바꿈 처리', () => {
    it('should convert newlines to spaces', () => {
      const input = '완벽한 휠\n가치를 되찾다';
      assert.equal(cleanSubtitle(input), '완벽한 휠 가치를 되찾다');
    });

    it('should handle multiple newlines', () => {
      const input = '새 휠\n\n다시 태어나다';
      assert.equal(cleanSubtitle(input), '새 휠 다시 태어나다');
    });
  });

  describe('번호 목록 제거', () => {
    it('should remove numbered list prefix', () => {
      const input = '1. 완벽한 휠 복원';
      assert.equal(cleanSubtitle(input), '완벽한 휠 복원');
    });
  });

  describe('복합 케이스', () => {
    it('should clean complex AI response', () => {
      const input = `**선택 1:** "낡은 휠, 명품으로 부활"

**선택 2:** "휠 복원, 가치를 더하다"

**선택 3:** "새 휠 같은 복원, 놀라운 변화"`;
      const result = cleanSubtitle(input);
      assert.equal(result, '낡은 휠, 명품으로 부활');
    });

    it('should handle simple clean text', () => {
      const input = '완벽한 휠, 가치를 되찾다';
      assert.equal(cleanSubtitle(input), '완벽한 휠, 가치를 되찾다');
    });
  });

  describe('edge cases', () => {
    it('should handle null', () => {
      assert.equal(cleanSubtitle(null), null);
    });

    it('should handle undefined', () => {
      assert.equal(cleanSubtitle(undefined), undefined);
    });

    it('should handle empty string', () => {
      assert.equal(cleanSubtitle(''), '');
    });
  });
});
