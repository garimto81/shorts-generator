/**
 * BGM 비트 동기화 모듈
 *
 * BPM 기반 전환 타이밍 계산 및 오디오 분석 유틸리티
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

/**
 * 일반적인 음악 장르별 BPM 범위
 */
export const BPM_PRESETS = {
  slow: { bpm: 80, name: '슬로우', description: '발라드, 느린 곡' },
  medium: { bpm: 110, name: '미디엄', description: '팝, 일반적인 곡' },
  upbeat: { bpm: 128, name: '업비트', description: '댄스, EDM, 신나는 곡' },
  fast: { bpm: 150, name: '패스트', description: '빠른 곡, 하이템포' }
};

/**
 * BPM 프리셋 이름 목록
 */
export const BPM_PRESET_NAMES = Object.keys(BPM_PRESETS);

/**
 * BPM을 기반으로 비트 간격 계산
 * @param {number} bpm - 분당 박자 수
 * @returns {number} 비트 간격 (초)
 */
export function getBeatInterval(bpm) {
  return 60 / bpm;
}

/**
 * BPM에 맞춰 사진 재생 시간 계산
 * 각 사진이 정확히 N 비트에 맞춰 끝나도록 조정
 * @param {number} baseDuration - 기본 재생 시간 (초)
 * @param {number} bpm - 분당 박자 수
 * @param {number} beatsPerPhoto - 사진당 비트 수 (기본: 가장 가까운 4의 배수)
 * @returns {number} 조정된 재생 시간 (초)
 */
export function alignDurationToBeat(baseDuration, bpm, beatsPerPhoto = null) {
  const beatInterval = getBeatInterval(bpm);

  if (beatsPerPhoto) {
    return beatsPerPhoto * beatInterval;
  }

  // 기본 재생 시간에 가장 가까운 4비트 배수로 반올림
  const beatsInDuration = baseDuration / beatInterval;
  const roundedBeats = Math.round(beatsInDuration / 4) * 4;
  const alignedBeats = Math.max(4, roundedBeats); // 최소 4비트

  return alignedBeats * beatInterval;
}

/**
 * 전환 효과가 비트에 맞도록 전환 시간 조정
 * @param {number} transitionDuration - 기본 전환 시간 (초)
 * @param {number} bpm - 분당 박자 수
 * @returns {number} 비트에 맞춘 전환 시간 (초)
 */
export function alignTransitionToBeat(transitionDuration, bpm) {
  const beatInterval = getBeatInterval(bpm);

  // 전환은 보통 1-2비트가 적당
  const beatsInTransition = transitionDuration / beatInterval;
  const roundedBeats = Math.max(1, Math.round(beatsInTransition));

  return roundedBeats * beatInterval;
}

/**
 * 사진 배열에 비트 동기화된 재생 시간 적용
 * @param {Array} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {number|string} options.bpm - BPM 또는 프리셋 이름
 * @param {number} options.baseDuration - 기본 재생 시간
 * @param {number} options.beatsPerPhoto - 사진당 비트 수 (옵션)
 * @returns {Array} 비트 동기화된 사진 배열
 */
export function applyBeatSync(photos, options = {}) {
  const {
    bpm: bpmInput = 'medium',
    baseDuration = 3,
    beatsPerPhoto = null
  } = options;

  // BPM 결정 (프리셋 또는 직접 지정)
  let bpm;
  if (typeof bpmInput === 'string') {
    const preset = BPM_PRESETS[bpmInput];
    if (!preset) {
      throw new Error(`알 수 없는 BPM 프리셋: ${bpmInput}. 사용 가능: ${BPM_PRESET_NAMES.join(', ')}`);
    }
    bpm = preset.bpm;
  } else {
    bpm = bpmInput;
  }

  const beatInterval = getBeatInterval(bpm);

  return photos.map((photo, index) => {
    const originalDuration = photo.dynamicDuration || baseDuration;
    const syncedDuration = alignDurationToBeat(originalDuration, bpm, beatsPerPhoto);

    return {
      ...photo,
      dynamicDuration: syncedDuration,
      beatSyncInfo: {
        bpm,
        beatInterval,
        beats: Math.round(syncedDuration / beatInterval),
        originalDuration
      }
    };
  });
}

/**
 * 비트 동기화 정보 요약 생성
 * @param {Array} photos - 비트 동기화된 사진 배열
 * @param {number} transitionDuration - 전환 시간
 * @returns {Object} 요약 정보
 */
export function getBeatSyncSummary(photos, transitionDuration = 0.5) {
  if (!photos.length || !photos[0].beatSyncInfo) {
    return null;
  }

  const bpm = photos[0].beatSyncInfo.bpm;
  const beatInterval = getBeatInterval(bpm);
  const totalDuration = photos.reduce((sum, p) => sum + (p.dynamicDuration || 0), 0)
    - (photos.length - 1) * transitionDuration;
  const totalBeats = Math.round(totalDuration / beatInterval);

  return {
    bpm,
    beatInterval: beatInterval.toFixed(3),
    totalDuration: totalDuration.toFixed(2),
    totalBeats,
    photoDurations: photos.map(p => ({
      duration: p.dynamicDuration?.toFixed(2),
      beats: p.beatSyncInfo?.beats
    }))
  };
}

/**
 * FFmpeg로 오디오 정보 추출
 * @param {string} audioPath - 오디오 파일 경로
 * @returns {Promise<Object>} 오디오 정보
 */
export async function getAudioInfo(audioPath) {
  if (!existsSync(audioPath)) {
    throw new Error(`오디오 파일을 찾을 수 없습니다: ${audioPath}`);
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration,bit_rate',
      '-of', 'json',
      audioPath
    ];

    const ffprobe = spawn('ffprobe', args);
    let output = '';
    let error = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          resolve({
            duration: parseFloat(info.format?.duration || 0),
            bitRate: parseInt(info.format?.bit_rate || 0)
          });
        } catch (e) {
          reject(new Error('오디오 정보 파싱 실패'));
        }
      } else {
        reject(new Error(`ffprobe 실패: ${error}`));
      }
    });

    ffprobe.on('error', reject);
  });
}
