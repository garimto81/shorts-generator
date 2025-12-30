/**
 * beat-sync.js 단위 테스트
 * Node.js 내장 테스트 러너 사용 (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BPM_PRESETS,
  BPM_PRESET_NAMES,
  getBeatInterval,
  alignDurationToBeat,
  alignTransitionToBeat,
  applyBeatSync,
  getBeatSyncSummary
} from '../src/audio/beat-sync.js';

describe('beat-sync', () => {
  describe('BPM_PRESETS', () => {
    it('should have 4 presets', () => {
      assert.equal(BPM_PRESET_NAMES.length, 4);
    });

    it('should have valid BPM values', () => {
      assert.equal(BPM_PRESETS.slow.bpm, 80);
      assert.equal(BPM_PRESETS.medium.bpm, 110);
      assert.equal(BPM_PRESETS.upbeat.bpm, 128);
      assert.equal(BPM_PRESETS.fast.bpm, 150);
    });

    it('should have name and description for each preset', () => {
      for (const key of BPM_PRESET_NAMES) {
        const preset = BPM_PRESETS[key];
        assert.ok(preset.name, `${key} should have name`);
        assert.ok(preset.description, `${key} should have description`);
      }
    });
  });

  describe('getBeatInterval()', () => {
    it('should calculate beat interval for 60 BPM', () => {
      // 60 BPM = 1 beat per second
      assert.equal(getBeatInterval(60), 1);
    });

    it('should calculate beat interval for 120 BPM', () => {
      // 120 BPM = 0.5 seconds per beat
      assert.equal(getBeatInterval(120), 0.5);
    });

    it('should calculate beat interval for 128 BPM', () => {
      // 128 BPM = 60/128 = 0.46875 seconds per beat
      assert.equal(getBeatInterval(128), 60 / 128);
    });
  });

  describe('alignDurationToBeat()', () => {
    it('should align 3 seconds to nearest 4-beat multiple at 120 BPM', () => {
      // 120 BPM = 0.5s per beat
      // 3s = 6 beats -> round to nearest 4 -> 8 beats = 4s
      const result = alignDurationToBeat(3, 120);
      assert.equal(result, 4); // 8 beats * 0.5s = 4s
    });

    it('should ensure minimum 4 beats', () => {
      // 120 BPM, 0.5s duration = 1 beat -> should become 4 beats = 2s
      const result = alignDurationToBeat(0.5, 120);
      assert.equal(result, 2); // 4 beats * 0.5s = 2s
    });

    it('should use specified beatsPerPhoto', () => {
      // 120 BPM, 8 beats specified = 4s
      const result = alignDurationToBeat(3, 120, 8);
      assert.equal(result, 4);
    });

    it('should handle 80 BPM (slow)', () => {
      // 80 BPM = 0.75s per beat
      // 3s = 4 beats -> round to 4 -> 4 beats = 3s
      const beatInterval = 60 / 80; // 0.75s
      const result = alignDurationToBeat(3, 80);
      assert.equal(result, 4 * beatInterval); // 4 beats
    });
  });

  describe('alignTransitionToBeat()', () => {
    it('should align transition to at least 1 beat', () => {
      // 120 BPM, 0.2s transition = 0.4 beats -> round to 1 beat = 0.5s
      const result = alignTransitionToBeat(0.2, 120);
      assert.equal(result, 0.5);
    });

    it('should align 0.5s transition at 120 BPM to 1 beat', () => {
      // 0.5s = 1 beat exactly
      const result = alignTransitionToBeat(0.5, 120);
      assert.equal(result, 0.5);
    });

    it('should round transition to nearest beat', () => {
      // 120 BPM, 0.7s = 1.4 beats -> round to 1 beat = 0.5s
      const result = alignTransitionToBeat(0.7, 120);
      assert.equal(result, 0.5);
    });
  });

  describe('applyBeatSync()', () => {
    const mockPhotos = [
      { id: '1', title: 'Photo 1' },
      { id: '2', title: 'Photo 2' },
      { id: '3', title: 'Photo 3' }
    ];

    it('should apply beat sync with preset name', () => {
      const result = applyBeatSync(mockPhotos, { bpm: 'medium', baseDuration: 3 });

      assert.equal(result.length, 3);
      result.forEach(photo => {
        assert.ok(photo.dynamicDuration, 'should have dynamicDuration');
        assert.ok(photo.beatSyncInfo, 'should have beatSyncInfo');
        assert.equal(photo.beatSyncInfo.bpm, 110, 'should use medium BPM');
      });
    });

    it('should apply beat sync with numeric BPM', () => {
      const result = applyBeatSync(mockPhotos, { bpm: 128, baseDuration: 3 });

      assert.equal(result[0].beatSyncInfo.bpm, 128);
    });

    it('should throw error for unknown preset', () => {
      assert.throws(
        () => applyBeatSync(mockPhotos, { bpm: 'invalid' }),
        /알 수 없는 BPM 프리셋/
      );
    });

    it('should preserve original photo properties', () => {
      const result = applyBeatSync(mockPhotos, { bpm: 'medium' });

      assert.equal(result[0].id, '1');
      assert.equal(result[0].title, 'Photo 1');
    });

    it('should track original duration in beatSyncInfo', () => {
      const photosWithDuration = [
        { id: '1', dynamicDuration: 5 }
      ];

      const result = applyBeatSync(photosWithDuration, { bpm: 120, baseDuration: 3 });

      assert.equal(result[0].beatSyncInfo.originalDuration, 5);
    });

    it('should use baseDuration when photo has no dynamicDuration', () => {
      const result = applyBeatSync(mockPhotos, { bpm: 120, baseDuration: 3 });

      assert.equal(result[0].beatSyncInfo.originalDuration, 3);
    });
  });

  describe('getBeatSyncSummary()', () => {
    it('should return null for empty array', () => {
      const result = getBeatSyncSummary([]);
      assert.equal(result, null);
    });

    it('should return null if no beatSyncInfo', () => {
      const photos = [{ id: '1' }];
      const result = getBeatSyncSummary(photos);
      assert.equal(result, null);
    });

    it('should generate summary for synced photos', () => {
      const syncedPhotos = applyBeatSync(
        [{ id: '1' }, { id: '2' }],
        { bpm: 120, baseDuration: 3 }
      );

      const result = getBeatSyncSummary(syncedPhotos, 0.5);

      assert.ok(result, 'should return summary');
      assert.equal(result.bpm, 120);
      assert.ok(result.beatInterval, 'should have beatInterval');
      assert.ok(result.totalDuration, 'should have totalDuration');
      assert.ok(result.totalBeats, 'should have totalBeats');
      assert.equal(result.photoDurations.length, 2);
    });
  });
});
