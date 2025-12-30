/**
 * photo-sorter.js 단위 테스트
 * Node.js 내장 테스트 러너 사용 (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractSortKey,
  sortPhotos,
  SORT_MODES
} from '../src/utils/photo-sorter.js';

describe('photo-sorter', () => {
  describe('SORT_MODES', () => {
    it('should have 3 modes', () => {
      assert.equal(Object.keys(SORT_MODES).length, 3);
    });

    it('should have filename, created, none modes', () => {
      assert.ok(SORT_MODES.filename);
      assert.ok(SORT_MODES.created);
      assert.ok(SORT_MODES.none);
    });
  });

  describe('extractSortKey()', () => {
    describe('카카오톡 패턴', () => {
      it('should extract _01_ from kakao filename', () => {
        const filename = 'kakao_talk_20251229_184022484_01_6wa37nkaqv.jpg';
        assert.equal(extractSortKey(filename), 1);
      });

      it('should extract _09_ from kakao filename', () => {
        const filename = 'kakao_talk_20251229_184022484_09_80z5em3g52.jpg';
        assert.equal(extractSortKey(filename), 9);
      });

      it('should extract _12_ from kakao filename', () => {
        const filename = 'kakao_talk_20251229_184022484_12_abcd1234.jpg';
        assert.equal(extractSortKey(filename), 12);
      });
    });

    describe('IMG 패턴', () => {
      it('should extract 4235 from img filename', () => {
        const filename = 'img_4235_0jli6sszed.jpg';
        assert.equal(extractSortKey(filename), 4235);
      });

      it('should extract 0001 from img filename', () => {
        const filename = 'img_0001_hash.jpg';
        assert.equal(extractSortKey(filename), 1);
      });
    });

    describe('일반 숫자 패턴', () => {
      it('should extract first number from filename', () => {
        const filename = 'photo_123_hash.jpg';
        assert.equal(extractSortKey(filename), 123);
      });
    });

    describe('Fallback', () => {
      it('should return lowercase filename when no number found', () => {
        const filename = 'photo_gbb7wik8im.jpg';
        // 'gbb7wik8im' 부분에서 숫자 7, 8을 찾을 수 있음
        // photo_ 부분은 숫자가 없으므로 전체에서 첫 숫자를 찾음
        const result = extractSortKey(filename);
        assert.equal(typeof result, 'number'); // 7 추출
      });

      it('should return lowercase filename for pure alpha', () => {
        const filename = 'photo_abcdef.jpg';
        const result = extractSortKey(filename);
        assert.equal(result, 'photo_abcdef.jpg');
      });

      it('should return Infinity for empty filename', () => {
        assert.equal(extractSortKey(''), Infinity);
      });

      it('should return Infinity for null/undefined', () => {
        assert.equal(extractSortKey(null), Infinity);
        assert.equal(extractSortKey(undefined), Infinity);
      });
    });
  });

  describe('sortPhotos()', () => {
    const testPhotos = [
      { id: '1', image: 'kakao_talk_20251229_184022484_08_nkm1mjmzk5.jpg' },
      { id: '2', image: 'kakao_talk_20251229_184022484_01_6wa37nkaqv.jpg' },
      { id: '3', image: 'kakao_talk_20251229_184022484_05_q7jdyr83u1.jpg' },
      { id: '4', image: 'kakao_talk_20251229_184022484_03_abc123.jpg' },
    ];

    describe('filename 정렬', () => {
      it('should sort kakao photos by sequence number', () => {
        const sorted = sortPhotos(testPhotos, 'filename');

        assert.equal(sorted[0].id, '2'); // _01_
        assert.equal(sorted[1].id, '4'); // _03_
        assert.equal(sorted[2].id, '3'); // _05_
        assert.equal(sorted[3].id, '1'); // _08_
      });

      it('should not mutate original array', () => {
        const original = [...testPhotos];
        sortPhotos(testPhotos, 'filename');
        assert.deepEqual(testPhotos, original);
      });
    });

    describe('혼합 패턴 정렬', () => {
      const mixedPhotos = [
        { id: '1', image: 'kakao_talk_20251229_184022484_02_hash.jpg' },
        { id: '2', image: 'img_4235_hash.jpg' },
        { id: '3', image: 'kakao_talk_20251229_184022484_01_hash.jpg' },
        { id: '4', image: 'photo_abcdef.jpg' },
      ];

      it('should sort mixed patterns (numbers first, then strings)', () => {
        const sorted = sortPhotos(mixedPhotos, 'filename');

        // 숫자 순: 1 (kakao_01), 2 (kakao_02), 4235 (img)
        // 문자열: photo_abcdef.jpg
        assert.equal(sorted[0].id, '3'); // _01_
        assert.equal(sorted[1].id, '1'); // _02_
        assert.equal(sorted[2].id, '2'); // 4235
        assert.equal(sorted[3].id, '4'); // 문자열
      });
    });

    describe('none 정렬', () => {
      it('should return original order when sortBy is none', () => {
        const sorted = sortPhotos(testPhotos, 'none');
        assert.deepEqual(sorted.map(p => p.id), ['1', '2', '3', '4']);
      });
    });

    describe('created 정렬', () => {
      const photosWithDates = [
        { id: '1', image: 'a.jpg', created: '2025-01-03' },
        { id: '2', image: 'b.jpg', created: '2025-01-01' },
        { id: '3', image: 'c.jpg', created: '2025-01-02' },
      ];

      it('should sort by created date', () => {
        const sorted = sortPhotos(photosWithDates, 'created');

        assert.equal(sorted[0].id, '2'); // 01-01
        assert.equal(sorted[1].id, '3'); // 01-02
        assert.equal(sorted[2].id, '1'); // 01-03
      });
    });

    describe('기본값', () => {
      it('should use filename as default sort mode', () => {
        const sorted = sortPhotos(testPhotos);
        assert.equal(sorted[0].id, '2'); // _01_
      });
    });

    describe('Edge cases', () => {
      it('should handle empty array', () => {
        const sorted = sortPhotos([], 'filename');
        assert.deepEqual(sorted, []);
      });

      it('should handle null/undefined', () => {
        assert.deepEqual(sortPhotos(null), null);
        assert.deepEqual(sortPhotos(undefined), undefined);
      });

      it('should handle single item', () => {
        const single = [{ id: '1', image: 'test.jpg' }];
        const sorted = sortPhotos(single, 'filename');
        assert.equal(sorted.length, 1);
      });
    });
  });
});
