/**
 * 인트로/아웃트로 생성기
 *
 * 영상 시작과 끝에 브랜딩 슬라이드를 추가합니다.
 * FFmpeg drawtext와 solid color background를 활용합니다.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 인트로/아웃트로 프리셋
 */
export const INTRO_OUTRO_PRESETS = {
  // 심플 텍스트 인트로
  simple: {
    name: '심플',
    description: '깔끔한 텍스트 인트로',
    duration: 2,
    backgroundColor: '0x000000',
    textColor: '0xFFFFFF',
    fontSize: 80,
    animation: 'fade'
  },

  // 브랜드 강조
  brand: {
    name: '브랜드',
    description: '브랜드명 강조 인트로',
    duration: 3,
    backgroundColor: '0x1a1a2e',
    textColor: '0xedf2f4',
    fontSize: 90,
    animation: 'fade'
  },

  // 미니멀
  minimal: {
    name: '미니멀',
    description: '짧고 간결한 인트로',
    duration: 1.5,
    backgroundColor: '0xffffff',
    textColor: '0x000000',
    fontSize: 70,
    animation: 'fade'
  },

  // CTA (Call to Action) - 아웃트로용
  cta: {
    name: 'CTA',
    description: '구독/좋아요 유도 아웃트로',
    duration: 3,
    backgroundColor: '0x2d3436',
    textColor: '0xfdcb6e',
    fontSize: 60,
    animation: 'fade',
    subText: '구독과 좋아요 부탁드립니다!'
  }
};

/**
 * 프리셋 이름 목록
 */
export const INTRO_OUTRO_PRESET_NAMES = Object.keys(INTRO_OUTRO_PRESETS);

/**
 * 인트로 FFmpeg 필터 생성
 * @param {Object} options - 옵션
 * @param {string} options.text - 표시할 텍스트
 * @param {string} options.preset - 프리셋 이름
 * @param {number} options.width - 영상 너비
 * @param {number} options.height - 영상 높이
 * @param {number} options.fps - 프레임 레이트
 * @param {string} options.fontPath - 폰트 경로
 * @returns {{filter: string, duration: number}}
 */
export function generateIntroFilter(options) {
  const {
    text,
    preset = 'simple',
    width = 1080,
    height = 1920,
    fps = 30,
    fontPath
  } = options;

  const config = INTRO_OUTRO_PRESETS[preset] || INTRO_OUTRO_PRESETS.simple;
  const { duration, backgroundColor, textColor, fontSize } = config;

  // 폰트 경로 처리
  let font = fontPath || join(__dirname, '../../assets/fonts/NotoSansKR-Bold.otf');
  if (!existsSync(font)) {
    font = 'sans';  // 시스템 기본 폰트 폴백
  }
  font = font.replace(/\\/g, '/').replace(/:/g, '\\:');

  // 텍스트 이스케이프
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");

  // FFmpeg 필터: 검정 배경 + 텍스트 + 페이드인/아웃
  const filter = `color=c=${backgroundColor}:s=${width}x${height}:d=${duration}:r=${fps},` +
    `format=yuv420p,` +
    `drawtext=fontfile='${font}':text='${escapedText}':` +
    `fontsize=${fontSize}:fontcolor=${textColor}:` +
    `x=(w-text_w)/2:y=(h-text_h)/2,` +
    `fade=t=in:st=0:d=0.5,fade=t=out:st=${duration - 0.5}:d=0.5`;

  return { filter, duration };
}

/**
 * 아웃트로 FFmpeg 필터 생성
 * @param {Object} options - 옵션
 * @param {string} options.text - 메인 텍스트
 * @param {string} options.subText - 서브 텍스트 (옵션)
 * @param {string} options.preset - 프리셋 이름
 * @param {number} options.width - 영상 너비
 * @param {number} options.height - 영상 높이
 * @param {number} options.fps - 프레임 레이트
 * @param {string} options.fontPath - 폰트 경로
 * @returns {{filter: string, duration: number}}
 */
export function generateOutroFilter(options) {
  const {
    text,
    subText,
    preset = 'cta',
    width = 1080,
    height = 1920,
    fps = 30,
    fontPath
  } = options;

  const config = INTRO_OUTRO_PRESETS[preset] || INTRO_OUTRO_PRESETS.cta;
  const { duration, backgroundColor, textColor, fontSize } = config;
  const actualSubText = subText || config.subText || '';

  // 폰트 경로 처리
  let font = fontPath || join(__dirname, '../../assets/fonts/NotoSansKR-Bold.otf');
  if (!existsSync(font)) {
    font = 'sans';
  }
  font = font.replace(/\\/g, '/').replace(/:/g, '\\:');

  // 텍스트 이스케이프
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");

  const escapedSubText = actualSubText
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");

  // 메인 텍스트 + 서브 텍스트
  let filter = `color=c=${backgroundColor}:s=${width}x${height}:d=${duration}:r=${fps},` +
    `format=yuv420p,` +
    `drawtext=fontfile='${font}':text='${escapedText}':` +
    `fontsize=${fontSize}:fontcolor=${textColor}:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-50`;

  // 서브 텍스트 추가
  if (actualSubText) {
    filter += `,drawtext=fontfile='${font}':text='${escapedSubText}':` +
      `fontsize=${Math.floor(fontSize * 0.5)}:fontcolor=${textColor}:` +
      `x=(w-text_w)/2:y=(h-text_h)/2+80`;
  }

  // 페이드인/아웃
  filter += `,fade=t=in:st=0:d=0.5,fade=t=out:st=${duration - 0.5}:d=0.5`;

  return { filter, duration };
}

/**
 * 인트로/아웃트로 설정 검증
 * @param {Object} config - 설정 객체
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateIntroOutroConfig(config) {
  const errors = [];

  if (config.intro?.enabled && !config.intro?.text) {
    errors.push('인트로 텍스트가 필요합니다');
  }

  if (config.outro?.enabled && !config.outro?.text) {
    errors.push('아웃트로 텍스트가 필요합니다');
  }

  if (config.intro?.preset && !INTRO_OUTRO_PRESETS[config.intro.preset]) {
    errors.push(`알 수 없는 인트로 프리셋: ${config.intro.preset}`);
  }

  if (config.outro?.preset && !INTRO_OUTRO_PRESETS[config.outro.preset]) {
    errors.push(`알 수 없는 아웃트로 프리셋: ${config.outro.preset}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
