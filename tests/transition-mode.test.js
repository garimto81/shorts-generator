/**
 * 전환 효과 모드 테스트
 * Node.js 내장 테스트 러너 사용
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TRANSITIONS,
  TRANSITION_MODES,
  TRANSITION_MODE_NAMES
} from '../src/video/generator.js';

describe('transition-mode', () => {
  describe('TRANSITIONS', () => {
    it('should have 10 transition effects', () => {
      assert.equal(TRANSITIONS.length, 10);
    });

    it('should include common transitions', () => {
      assert.ok(TRANSITIONS.includes('fade'));
      assert.ok(TRANSITIONS.includes('slideright'));
      assert.ok(TRANSITIONS.includes('slideleft'));
    });
  });

  describe('TRANSITION_MODES', () => {
    it('should have 3 modes', () => {
      assert.equal(TRANSITION_MODE_NAMES.length, 3);
    });

    it('should have single, sequential, and random modes', () => {
      assert.ok(TRANSITION_MODE_NAMES.includes('single'));
      assert.ok(TRANSITION_MODE_NAMES.includes('sequential'));
      assert.ok(TRANSITION_MODE_NAMES.includes('random'));
    });

    it('should have description for each mode', () => {
      for (const mode of TRANSITION_MODE_NAMES) {
        assert.ok(TRANSITION_MODES[mode], `${mode} should have description`);
        assert.ok(typeof TRANSITION_MODES[mode] === 'string');
      }
    });
  });
});
