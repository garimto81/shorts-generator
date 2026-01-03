/**
 * 자막 포맷팅 테스트 - Issue #23 자막 퀄리티 종합 개선
 * Node.js 내장 테스트 러너 사용 (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatSubtitle,
  preventParticleSeparation,
  calculateDynamicFontSize,
  splitAtMeaningfulBoundary,
  KOREAN_PARTICLES
} from '../src/video/subtitle.js';

describe('KOREAN_PARTICLES', () => {
  it('should include common Korean particles', () => {
    const particles = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '로', '와', '과', '도', '만', '까지', '부터'];
    particles.forEach(p => {
      assert.ok(KOREAN_PARTICLES.includes(p), `${p} should be in KOREAN_PARTICLES`);
    });
  });
});

describe('preventParticleSeparation()', () => {
  describe('basic particle prevention', () => {
    it('should not separate 은/는 from previous word', () => {
      // "휠은" should stay together, not "휠" + "은"
      const result = preventParticleSeparation('휠은 새롭게 복원되었습니다', 10);
      assert.ok(!result.includes('휠\n은'), 'should not separate 휠 and 은');
    });

    it('should not separate 이/가 from previous word', () => {
      const result = preventParticleSeparation('복원이 완료되었습니다', 8);
      assert.ok(!result.includes('복원\n이'), 'should not separate 복원 and 이');
    });

    it('should not separate 을/를 from previous word', () => {
      const result = preventParticleSeparation('휠을 복원합니다', 6);
      assert.ok(!result.includes('휠\n을'), 'should not separate 휠 and 을');
    });

    it('should not separate 에/에서 from previous word', () => {
      const result = preventParticleSeparation('공장에서 작업 중', 8);
      assert.ok(!result.includes('공장\n에서'), 'should not separate 공장 and 에서');
    });

    it('should not separate 으로/로 from previous word', () => {
      const result = preventParticleSeparation('새것으로 변신합니다', 8);
      assert.ok(!result.includes('새것\n으로'), 'should not separate 새것 and 으로');
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined', () => {
      assert.equal(preventParticleSeparation(null, 10), null);
      assert.equal(preventParticleSeparation(undefined, 10), undefined);
    });

    it('should return original text if short enough', () => {
      const text = '짧은 텍스트';
      assert.equal(preventParticleSeparation(text, 20), text);
    });

    it('should handle text without particles', () => {
      const text = 'ABC DEF GHI';
      const result = preventParticleSeparation(text, 5);
      assert.ok(typeof result === 'string');
    });
  });
});

describe('calculateDynamicFontSize()', () => {
  describe('font size calculation', () => {
    it('should return default size for short text', () => {
      const result = calculateDynamicFontSize('짧은', { baseSize: 60 });
      assert.equal(result, 60);
    });

    it('should reduce size for medium text', () => {
      const result = calculateDynamicFontSize('이것은 중간 길이 텍스트입니다', { baseSize: 60 });
      assert.ok(result >= 50 && result <= 60, `Expected 50-60, got ${result}`);
    });

    it('should reduce more for long text', () => {
      const result = calculateDynamicFontSize('이것은 매우 긴 텍스트입니다. 여러 줄에 걸쳐 표시됩니다.', { baseSize: 60 });
      assert.ok(result >= 40 && result < 60, `Expected 40-60, got ${result}`);
    });

    it('should respect minimum size', () => {
      const veryLongText = '가나다라마바사아자차카타파하'.repeat(10);
      const result = calculateDynamicFontSize(veryLongText, { baseSize: 60, minSize: 40 });
      assert.ok(result >= 40, `Should not go below minSize 40, got ${result}`);
    });

    it('should use default options when not provided', () => {
      const result = calculateDynamicFontSize('테스트');
      assert.ok(typeof result === 'number');
      assert.ok(result > 0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const result = calculateDynamicFontSize('', { baseSize: 60 });
      assert.equal(result, 60);
    });

    it('should handle null/undefined', () => {
      const result1 = calculateDynamicFontSize(null, { baseSize: 60 });
      const result2 = calculateDynamicFontSize(undefined, { baseSize: 60 });
      assert.equal(result1, 60);
      assert.equal(result2, 60);
    });
  });
});

describe('splitAtMeaningfulBoundary()', () => {
  describe('punctuation-based splitting', () => {
    it('should split at comma', () => {
      const result = splitAtMeaningfulBoundary('첫 번째 문장, 두 번째 문장', 15);
      assert.ok(result.includes('\n'), 'should have line break');
      assert.ok(result.indexOf(',') < result.indexOf('\n'), 'comma should come before line break');
    });

    it('should split at period', () => {
      const result = splitAtMeaningfulBoundary('첫 번째 문장. 두 번째 문장', 15);
      assert.ok(result.includes('\n'), 'should have line break');
    });

    it('should split at exclamation mark', () => {
      const result = splitAtMeaningfulBoundary('놀라운 변화! 새 휠 탄생', 12);
      assert.ok(result.includes('\n'), 'should have line break');
    });
  });

  describe('word boundary preservation', () => {
    it('should split at word boundaries', () => {
      const result = splitAtMeaningfulBoundary('복원작업 진행중입니다', 8);
      // Should split at word boundary (space), not mid-word
      const lines = result.split('\n');
      assert.ok(lines.length >= 1, 'should produce lines');
      // Each line should be a complete word or phrase
      assert.ok(lines.every(line => line.trim().length > 0), 'no empty lines');
    });
  });

  describe('max lines limit', () => {
    it('should respect maxLines option', () => {
      const longText = '첫 번째. 두 번째. 세 번째. 네 번째. 다섯 번째.';
      const result = splitAtMeaningfulBoundary(longText, 10, { maxLines: 3 });
      const lineCount = result.split('\n').length;
      assert.ok(lineCount <= 3, `Expected max 3 lines, got ${lineCount}`);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined', () => {
      assert.equal(splitAtMeaningfulBoundary(null, 10), null);
      assert.equal(splitAtMeaningfulBoundary(undefined, 10), undefined);
    });

    it('should return original text if short enough', () => {
      const text = '짧음';
      assert.equal(splitAtMeaningfulBoundary(text, 10), text);
    });
  });
});

describe('formatSubtitle() integration', () => {
  it('should use particle prevention when enabled', () => {
    const result = formatSubtitle('휠은 새롭게 복원되었습니다', 12, {
      preventParticleSplit: true
    });
    assert.ok(!result.includes('휠\n은'), 'should not separate 휠 and 은');
  });

  it('should maintain backward compatibility', () => {
    // Existing behavior should still work
    const result = formatSubtitle('이것은 긴 텍스트입니다', 10);
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('\n') || result.length <= 10);
  });
});
