import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  PHASE_KEYWORDS,
  PHASE_EXCLUDE_KEYWORDS,
  PHASE_CONFIDENCE_THRESHOLD,
  extractPhaseFromMetadata,
  sortByPhase,
  getPhaseStats
} from '../src/ai/phase-sorter.js';

describe('phase-sorter', () => {
  describe('PHASE_KEYWORDS', () => {
    it('should have 4 phases', () => {
      assert.strictEqual(Object.keys(PHASE_KEYWORDS).length, 4);
    });

    it('should have overview, before, process, after phases', () => {
      assert.ok(PHASE_KEYWORDS.overview);
      assert.ok(PHASE_KEYWORDS.before);
      assert.ok(PHASE_KEYWORDS.process);
      assert.ok(PHASE_KEYWORDS.after);
    });

    it('should have keywords for each phase', () => {
      for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
        assert.ok(Array.isArray(keywords), `${phase} should have keywords array`);
        assert.ok(keywords.length > 0, `${phase} should have at least one keyword`);
      }
    });
  });

  describe('PHASE_EXCLUDE_KEYWORDS', () => {
    it('should have exclude keywords for after phase', () => {
      assert.ok(PHASE_EXCLUDE_KEYWORDS.after);
      assert.ok(Array.isArray(PHASE_EXCLUDE_KEYWORDS.after));
    });

    it('should exclude process-related terms from after', () => {
      assert.ok(PHASE_EXCLUDE_KEYWORDS.after.includes('작업'));
      assert.ok(PHASE_EXCLUDE_KEYWORDS.after.includes('스프레이'));
    });
  });

  describe('extractPhaseFromMetadata()', () => {
    describe('overview detection', () => {
      it('should detect 전체 keyword', () => {
        const photo = { id: '1', title: '차량 전체 모습' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'overview');
      });

      it('should detect full keyword', () => {
        const photo = { id: '1', image: 'full_view.jpg' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'overview');
      });
    });

    describe('before detection', () => {
      it('should detect 손상 keyword', () => {
        const photo = { id: '1', title: '휠 손상 상태' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'before');
      });

      it('should detect scratch keyword', () => {
        const photo = { id: '1', image: 'scratch_marks.jpg' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'before');
      });
    });

    describe('process detection', () => {
      it('should detect 작업 keyword', () => {
        const photo = { id: '1', title: '도색 작업 중' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'process');
      });

      it('should detect paint keyword', () => {
        const photo = { id: '1', image: 'paint_process.jpg' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'process');
      });
    });

    describe('after detection', () => {
      it('should detect 완료 keyword', () => {
        const photo = { id: '1', title: '작업 완료' };
        // '작업' is an exclude keyword for after, so should return 'process' instead
        assert.strictEqual(extractPhaseFromMetadata(photo), 'process');
      });

      it('should detect 완성 keyword without exclusion', () => {
        const photo = { id: '1', title: '휠 복원 완성' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'after');
      });

      it('should detect finish keyword', () => {
        const photo = { id: '1', image: 'finish_result.jpg' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'after');
      });
    });

    describe('exclude keywords', () => {
      it('should not classify as after when 스프레이 is present', () => {
        const photo = { id: '1', title: '스프레이 완료 후' };
        // '스프레이' excludes 'after', so the first matching phase wins
        assert.strictEqual(extractPhaseFromMetadata(photo), 'process');
      });

      it('should not classify as after when coating in progress', () => {
        const photo = { id: '1', title: 'coating finish' };
        // 'coating' is in exclude list for after, 'finish' would match after
        // but coating is also in process, so process wins first
        assert.strictEqual(extractPhaseFromMetadata(photo), 'process');
      });
    });

    describe('edge cases', () => {
      it('should return null for empty photo', () => {
        const photo = { id: '1' };
        assert.strictEqual(extractPhaseFromMetadata(photo), null);
      });

      it('should return null for no keyword match', () => {
        const photo = { id: '1', title: 'IMG_20240101_123456' };
        assert.strictEqual(extractPhaseFromMetadata(photo), null);
      });

      it('should be case insensitive', () => {
        const photo = { id: '1', title: 'BEFORE state' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'before');
      });

      it('should search both title and image filename', () => {
        const photo = { id: '1', title: 'random', image: 'damage_01.jpg' };
        assert.strictEqual(extractPhaseFromMetadata(photo), 'before');
      });
    });
  });

  describe('sortByPhase()', () => {
    let photos;
    let phaseMap;

    beforeEach(() => {
      photos = [
        { id: '1', title: 'photo 1' },
        { id: '2', title: 'photo 2' },
        { id: '3', title: 'photo 3' },
        { id: '4', title: 'photo 4' }
      ];

      phaseMap = new Map();
    });

    it('should sort by phase order', () => {
      phaseMap.set('1', { phase: 'after', phaseConfidence: 0.9 });
      phaseMap.set('2', { phase: 'before', phaseConfidence: 0.9 });
      phaseMap.set('3', { phase: 'overview', phaseConfidence: 0.9 });
      phaseMap.set('4', { phase: 'process', phaseConfidence: 0.9 });

      const sorted = sortByPhase(photos, phaseMap);

      assert.strictEqual(sorted[0].id, '3'); // overview (order 0)
      assert.strictEqual(sorted[1].id, '2'); // before (order 1)
      assert.strictEqual(sorted[2].id, '4'); // process (order 2)
      assert.strictEqual(sorted[3].id, '1'); // after (order 3)
    });

    it('should keep original order within same phase', () => {
      phaseMap.set('1', { phase: 'process', phaseConfidence: 0.9 });
      phaseMap.set('2', { phase: 'process', phaseConfidence: 0.9 });
      phaseMap.set('3', { phase: 'process', phaseConfidence: 0.9 });
      phaseMap.set('4', { phase: 'process', phaseConfidence: 0.9 });

      const sorted = sortByPhase(photos, phaseMap);

      assert.strictEqual(sorted[0].id, '1');
      assert.strictEqual(sorted[1].id, '2');
      assert.strictEqual(sorted[2].id, '3');
      assert.strictEqual(sorted[3].id, '4');
    });

    it('should move low confidence results to the end', () => {
      phaseMap.set('1', { phase: 'after', phaseConfidence: 0.9 });
      phaseMap.set('2', { phase: 'before', phaseConfidence: 0.3 }); // low confidence
      phaseMap.set('3', { phase: 'overview', phaseConfidence: 0.9 });
      phaseMap.set('4', { phase: 'process', phaseConfidence: 0.9 });

      const sorted = sortByPhase(photos, phaseMap);

      // Photo 2 should be at the end due to low confidence
      assert.strictEqual(sorted[3].id, '2');
    });

    it('should handle unknown phase', () => {
      phaseMap.set('1', { phase: 'unknown', phaseConfidence: 0.5 });
      phaseMap.set('2', { phase: 'before', phaseConfidence: 0.9 });
      phaseMap.set('3', { phase: 'after', phaseConfidence: 0.9 });
      phaseMap.set('4', { phase: 'process', phaseConfidence: 0.9 });

      const sorted = sortByPhase(photos, phaseMap);

      // Photo 1 (unknown) should be at the end
      assert.strictEqual(sorted[3].id, '1');
    });

    it('should handle empty phaseMap', () => {
      const sorted = sortByPhase(photos, new Map());

      // Should return in original order
      assert.strictEqual(sorted[0].id, '1');
      assert.strictEqual(sorted[1].id, '2');
      assert.strictEqual(sorted[2].id, '3');
      assert.strictEqual(sorted[3].id, '4');
    });

    it('should handle empty photos array', () => {
      const sorted = sortByPhase([], phaseMap);
      assert.strictEqual(sorted.length, 0);
    });
  });

  describe('getPhaseStats()', () => {
    it('should count phases correctly', () => {
      const phaseMap = new Map();
      phaseMap.set('1', { phase: 'overview', phaseConfidence: 0.9 });
      phaseMap.set('2', { phase: 'before', phaseConfidence: 0.8 });
      phaseMap.set('3', { phase: 'before', phaseConfidence: 0.7 });
      phaseMap.set('4', { phase: 'process', phaseConfidence: 0.9 });
      phaseMap.set('5', { phase: 'after', phaseConfidence: 0.95 });

      const stats = getPhaseStats(phaseMap);

      assert.strictEqual(stats.total, 5);
      assert.strictEqual(stats.byPhase.overview, 1);
      assert.strictEqual(stats.byPhase.before, 2);
      assert.strictEqual(stats.byPhase.process, 1);
      assert.strictEqual(stats.byPhase.after, 1);
      assert.strictEqual(stats.byPhase.unknown, 0);
    });

    it('should calculate average confidence', () => {
      const phaseMap = new Map();
      phaseMap.set('1', { phase: 'overview', phaseConfidence: 0.8 });
      phaseMap.set('2', { phase: 'before', phaseConfidence: 1.0 });

      const stats = getPhaseStats(phaseMap);

      assert.strictEqual(stats.avgConfidence, '0.90');
    });

    it('should count high and low confidence correctly', () => {
      const phaseMap = new Map();
      phaseMap.set('1', { phase: 'overview', phaseConfidence: 0.9 }); // high
      phaseMap.set('2', { phase: 'before', phaseConfidence: 0.5 }); // low
      phaseMap.set('3', { phase: 'unknown', phaseConfidence: 0.8 }); // unknown = low
      phaseMap.set('4', { phase: 'after', phaseConfidence: 0.7 }); // high

      const stats = getPhaseStats(phaseMap);

      assert.strictEqual(stats.highConfidenceCount, 2);
      assert.strictEqual(stats.lowConfidenceCount, 2);
    });

    it('should handle empty phaseMap', () => {
      const stats = getPhaseStats(new Map());

      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.avgConfidence, 0);
    });

    it('should use custom confidence threshold', () => {
      const phaseMap = new Map();
      phaseMap.set('1', { phase: 'overview', phaseConfidence: 0.75 });
      phaseMap.set('2', { phase: 'before', phaseConfidence: 0.85 });

      const stats = getPhaseStats(phaseMap, { confidenceThreshold: 0.8 });

      assert.strictEqual(stats.highConfidenceCount, 1); // only 0.85
      assert.strictEqual(stats.lowConfidenceCount, 1); // 0.75
    });
  });

  describe('PHASE_CONFIDENCE_THRESHOLD', () => {
    it('should be 0.6', () => {
      assert.strictEqual(PHASE_CONFIDENCE_THRESHOLD, 0.6);
    });
  });
});
