import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { formatSubtitle, SUBTITLE_STYLE } from './subtitle.js';
import { SUBTITLE_POSITIONS, SUBTITLE_STYLES } from './templates.js';
import { generateIntroFilter, generateOutroFilter, INTRO_OUTRO_PRESETS, INTRO_OUTRO_PRESET_NAMES } from './intro-outro.js';
import { SUBTITLE_ANIMATIONS, getFadeInAlpha } from './subtitle-animation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Ease-in-out cubic 이징 함수 (FFmpeg 표현식)
 * t = 정규화된 시간 (0~1)
 * 출력: ease-in-out으로 변환된 0~1 값
 * 수식: t < 0.5 ? 4*t^3 : 1 - pow(-2*t + 2, 3) / 2
 */
function easeInOutCubic(timeExpr) {
  // FFmpeg 표현식으로 ease-in-out cubic 구현
  return `if(lt(${timeExpr},0.5),4*pow(${timeExpr},3),1-pow(-2*${timeExpr}+2,3)/2)`;
}

/**
 * Ken Burns 패턴 정의 (Ease-in-out 이징 적용)
 * 각 패턴은 zoompan 필터의 z(줌), x(수평 위치), y(수직 위치) 표현식을 생성
 * 이징 곡선으로 자연스러운 가속/감속 효과 적용
 */
const KEN_BURNS_PATTERNS = {
  // 기본 줌 인 (중앙) - ease-in-out 적용
  zoomInCenter: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;  // 정규화된 시간 (0~1)
    const eased = easeInOutCubic(t);
    return {
      z: `1.0+(${intensity})*(${eased})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)'
    };
  },
  // 기본 줌 아웃 (중앙) - ease-in-out 적용
  zoomOutCenter: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `(1.0+${intensity})-(${intensity})*(${eased})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)'
    };
  },
  // 좌상단에서 우하단으로 패닝 + 줌 인 - ease-in-out 적용
  panLeftTopToRightBottom: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `1.0+(${intensity})*(${eased})`,
      x: `(iw*0.1)+(iw*0.3)*(${eased})`,
      y: `(ih*0.1)+(ih*0.3)*(${eased})`
    };
  },
  // 우상단에서 좌하단으로 패닝 + 줌 인 - ease-in-out 적용
  panRightTopToLeftBottom: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `1.0+(${intensity})*(${eased})`,
      x: `(iw*0.4)-(iw*0.3)*(${eased})`,
      y: `(ih*0.1)+(ih*0.3)*(${eased})`
    };
  },
  // 좌우 패닝 (줌 고정) - ease-in-out 적용
  panLeftToRight: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `1.0+${intensity * 0.5}`,
      x: `(iw*0.1)+(iw*0.3)*(${eased})`,
      y: 'ih/2-(ih/zoom/2)'
    };
  },
  // 우좌 패닝 (줌 고정) - ease-in-out 적용
  panRightToLeft: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `1.0+${intensity * 0.5}`,
      x: `(iw*0.4)-(iw*0.3)*(${eased})`,
      y: 'ih/2-(ih/zoom/2)'
    };
  },
  // 상하 패닝 + 줌 아웃 - ease-in-out 적용
  panTopToBottom: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `(1.0+${intensity})-(${intensity * 0.5})*(${eased})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih*0.15)+(ih*0.2)*(${eased})`
    };
  },
  // 하상 패닝 + 줌 인 - ease-in-out 적용
  panBottomToTop: (duration, fps, intensity) => {
    const t = `on/(${duration}*${fps})`;
    const eased = easeInOutCubic(t);
    return {
      z: `1.0+(${intensity * 0.5})*(${eased})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih*0.35)-(ih*0.2)*(${eased})`
    };
  }
};

/**
 * Ken Burns 패턴 이름 목록
 */
export const KEN_BURNS_PATTERN_NAMES = Object.keys(KEN_BURNS_PATTERNS);

/**
 * Ken Burns 패턴 선택
 * @param {number} index - 사진 인덱스
 * @param {string} mode - 'sequential' | 'random' | 'classic'
 * @returns {string} 패턴 이름
 */
function selectKenBurnsPattern(index, mode = 'sequential') {
  const patterns = KEN_BURNS_PATTERN_NAMES;

  if (mode === 'classic') {
    // 기존 방식: zoom in/out 교차
    return index % 2 === 0 ? 'zoomInCenter' : 'zoomOutCenter';
  }

  if (mode === 'random') {
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  // sequential: 순서대로 순환
  return patterns[index % patterns.length];
}

/**
 * Ken Burns 효과 표현식 생성
 * @param {number} index - 사진 인덱스
 * @param {number} duration - 표시 시간 (초)
 * @param {number} fps - 프레임 레이트
 * @param {number} intensity - 줌 강도 (0.0 ~ 0.3)
 * @param {string} mode - 패턴 선택 모드
 * @returns {{z: string, x: string, y: string}}
 */
function getKenBurnsEffect(index, duration, fps, intensity, mode = 'sequential') {
  const patternName = selectKenBurnsPattern(index, mode);
  const patternFn = KEN_BURNS_PATTERNS[patternName];
  return patternFn(duration, fps, intensity);
}

/**
 * Run FFmpeg command
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log('FFmpeg command:', 'ffmpeg', args.join(' '));
    console.log('Filter complex:', args[args.indexOf('-filter_complex') + 1]);
    const ffmpeg = spawn('ffmpeg', args, { stdio: 'inherit' });
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });
}

/**
 * Convert hex color to FFmpeg format
 */
function hexToFFmpegColor(hex) {
  if (hex.startsWith('#')) {
    return '0x' + hex.slice(1) + 'FF';
  }
  return hex;
}

/**
 * Escape text for FFmpeg drawtext filter
 */
function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * 전환 효과 매핑 (CLI 이름 → FFmpeg xfade 이름)
 */
const TRANSITION_MAP = {
  'fade': 'fade',
  'crossfade': 'fade',
  'directionalwipe': 'wipeleft',
  'slideright': 'slideright',
  'slideleft': 'slideleft',
  'slideup': 'slideup',
  'slidedown': 'slidedown',
  'radial': 'radial',
  'circleopen': 'circleopen',
  'directional': 'wiperight'
};

/**
 * 자동 순환에 적합한 전환 효과 목록 (fade 제외한 시각적 효과)
 */
const CYCLE_TRANSITIONS = [
  'slideright',
  'slideleft',
  'slideup',
  'slidedown',
  'radial',
  'circleopen',
  'wipeleft',
  'wiperight'
];

/**
 * 전환 모드 정의
 */
export const TRANSITION_MODES = {
  single: '단일 전환 (동일한 효과 반복)',
  sequential: '순차 순환 (전환 효과 순서대로 적용)',
  random: '무작위 (매번 다른 전환 효과)'
};

export const TRANSITION_MODE_NAMES = Object.keys(TRANSITION_MODES);

/**
 * Get transition filter between two clips
 * @param {string} transition - Transition type
 * @param {number} duration - Transition duration in seconds
 * @returns {string} FFmpeg xfade filter string
 */
function getTransitionFilter(transition, duration) {
  return TRANSITION_MAP[transition] || 'fade';
}

/**
 * 전환 모드에 따라 적절한 전환 효과 선택
 * @param {number} index - 현재 전환 인덱스 (0부터 시작)
 * @param {string} mode - 전환 모드 (single | sequential | random)
 * @param {string} defaultTransition - 기본 전환 효과
 * @returns {string} FFmpeg xfade 전환 효과 이름
 */
function selectTransition(index, mode, defaultTransition) {
  switch (mode) {
    case 'sequential':
      return CYCLE_TRANSITIONS[index % CYCLE_TRANSITIONS.length];
    case 'random':
      return CYCLE_TRANSITIONS[Math.floor(Math.random() * CYCLE_TRANSITIONS.length)];
    case 'single':
    default:
      return getTransitionFilter(defaultTransition);
  }
}

/**
 * Generate a marketing video from photos using FFmpeg filter_complex
 * Supports: subtitles, logo overlay, Ken Burns effect, transitions
 *
 * @param {Array} photos - Array of photo objects with localPath and title
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Output video path
 */
export async function generateVideo(photos, options = {}) {
  const { outputPath, bgmPath, logoPath, config } = options;
  const videoConfig = config.video;
  const brandingConfig = config.branding || {};
  const subtitleConfig = config.subtitle || {};
  const templateConfig = config.template || {};
  const introConfig = config.intro || {};
  const outroConfig = config.outro || {};

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const defaultDuration = videoConfig.photoDuration || 3;
  const width = videoConfig.width || 1080;
  const height = videoConfig.height || 1920;
  const fps = videoConfig.fps || 30;
  const transitionDuration = videoConfig.transitionDuration || 0.5;
  const transition = videoConfig.transition || 'fade';
  const transitionMode = videoConfig.transitionMode || 'single';  // single | sequential | random

  // 사진별 개별 duration 가져오기 (동적 duration 지원)
  const getPhotoDuration = (photo) => {
    return photo.dynamicDuration || defaultDuration;
  };

  // Template settings
  const useKenBurns = templateConfig.kenBurns !== false;
  const zoomIntensity = templateConfig.zoomIntensity ?? 0.15;
  const kenBurnsMode = templateConfig.kenBurnsMode || 'sequential';  // classic | sequential | random
  const subtitlePosition = templateConfig.subtitlePosition || 'bottom';
  const subtitleStyleName = templateConfig.subtitleStyle || 'default';
  const subtitleStyle = SUBTITLE_STYLES[subtitleStyleName] || SUBTITLE_STYLES.default;

  // Build input arguments
  // Single frame input - zoompan will generate all output frames
  const inputArgs = [];
  photos.forEach(photo => {
    inputArgs.push('-loop', '1', '-framerate', '1', '-t', '1', '-i', photo.localPath);
  });

  // Add logo input if enabled
  const logoEnabled = brandingConfig.enabled !== false && logoPath && existsSync(logoPath);
  if (logoEnabled) {
    inputArgs.push('-i', logoPath);
  }

  // Add BGM input if exists
  const bgmEnabled = bgmPath && existsSync(bgmPath);
  if (bgmEnabled) {
    inputArgs.push('-i', bgmPath);
  }

  // Build filter_complex
  const filters = [];
  const photoCount = photos.length;

  // 0. 인트로/아웃트로 생성 (활성화된 경우)
  const introEnabled = introConfig.enabled && introConfig.text;
  const outroEnabled = outroConfig.enabled && outroConfig.text;

  let introResult = null;
  let outroResult = null;

  if (introEnabled) {
    introResult = generateIntroFilter({
      text: introConfig.text,
      preset: introConfig.preset || 'simple',
      width,
      height,
      fps,
      fontPath: subtitleConfig.font
    });
    filters.push(`${introResult.filter}[intro]`);
  }

  if (outroEnabled) {
    outroResult = generateOutroFilter({
      text: outroConfig.text,
      subText: outroConfig.subText,
      preset: outroConfig.preset || 'cta',
      width,
      height,
      fps,
      fontPath: subtitleConfig.font
    });
    filters.push(`${outroResult.filter}[outro]`);
  }

  // 1. Scale and Ken Burns effect for each photo
  for (let i = 0; i < photoCount; i++) {
    const photo = photos[i];
    const photoDuration = getPhotoDuration(photo);

    if (useKenBurns && zoomIntensity > 0) {
      // Ken Burns: 다양한 패턴 적용 (zoom + pan 조합)
      const effect = getKenBurnsEffect(i, photoDuration, fps, zoomIntensity, kenBurnsMode);

      // Scale with Ken Burns (zoompan) - lanczos 고품질 스케일러 사용
      filters.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=${width * 2}:${height * 2},` +
        `zoompan=z='${effect.z}':x='${effect.x}':y='${effect.y}':d=${photoDuration * fps}:s=${width}x${height}:fps=${fps},` +
        `setsar=1[v${i}]`
      );
    } else {
      // No Ken Burns - simple scale and duration - lanczos 고품질 스케일러 사용
      filters.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
        `loop=loop=${photoDuration * fps}:size=1:start=0,` +
        `setpts=PTS-STARTPTS,fps=${fps},setsar=1[v${i}]`
      );
    }
  }

  // 2. Add subtitles to each video segment
  for (let i = 0; i < photoCount; i++) {
    const photo = photos[i];
    // 자막 우선순위: finalSubtitle (AI) > title > groupTitle
    const subtitleText = photo.finalSubtitle || photo.title || photo.groupTitle || '';
    const subtitle = subtitleText ? formatSubtitle(subtitleText, 15) : '';

    if (subtitle) {
      // 폰트 경로를 절대 경로로 변환 (FFmpeg 호환)
      let fontPath = subtitleConfig.font || './assets/fonts/NotoSansKR-Bold.otf';
      if (fontPath.startsWith('./')) {
        fontPath = join(__dirname, '../..', fontPath.slice(2));
      }
      // FFmpeg drawtext: 백슬래시→슬래시, 콜론 이스케이프
      fontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const fontSize = subtitleConfig.fontSize || subtitleStyle.fontSize || 60;
      const textColor = hexToFFmpegColor(subtitleConfig.textColor || '#FFFFFF');
      const borderWidth = subtitleStyle.borderWidth || 3;
      const escapedText = escapeText(subtitle);

      // Position based on template setting
      const yPos = SUBTITLE_POSITIONS[subtitlePosition] || SUBTITLE_POSITIONS.bottom;

      // 스타일 옵션: 배경 박스, 그림자
      const hasBackground = subtitleStyle.backgroundColor;
      const hasShadow = subtitleStyle.shadow;

      let drawtextParams = `fontfile='${fontPath}':text='${escapedText}':` +
        `fontsize=${fontSize}:fontcolor=${textColor}:` +
        `borderw=${borderWidth}:bordercolor=black:` +
        `x=(w-text_w)/2:y=${yPos}`;

      // 배경 박스 추가 (FFmpeg box 파라미터)
      if (hasBackground) {
        const bgColor = subtitleStyle.backgroundColor;
        const bgPadding = subtitleStyle.backgroundPadding || 10;
        drawtextParams += `:box=1:boxcolor=${bgColor}:boxborderw=${bgPadding}`;
      }

      // 그림자 효과 추가
      if (hasShadow) {
        const shadowX = subtitleStyle.shadowX || 3;
        const shadowY = subtitleStyle.shadowY || 3;
        const shadowColor = subtitleStyle.shadowColor || '0x00000080';
        drawtextParams += `:shadowx=${shadowX}:shadowy=${shadowY}:shadowcolor=${shadowColor}`;
      }

      // 자막 페이드인 애니메이션 추가 (0.4초)
      // 각 클립 내에서 t=0부터 시작하므로 clipStartTime=0
      const fadeInDuration = 0.4;
      const fadeInAlpha = `if(lt(t,${fadeInDuration}),t/${fadeInDuration},1)`;
      drawtextParams += `:alpha='${fadeInAlpha}'`;

      filters.push(`[v${i}]drawtext=${drawtextParams}[vt${i}]`);
    } else {
      filters.push(`[v${i}]null[vt${i}]`);
    }
  }

  // 3. Apply transitions between clips using xfade
  if (photoCount === 1) {
    // 단일 사진: 로고 + 인트로/아웃트로 처리
    if (logoEnabled) {
      const logoIdx = 1;
      const logoX = Math.floor(width * (brandingConfig.logoPosition?.x || 0.92) - (width * (brandingConfig.logoSize || 0.12) / 2));
      const logoY = Math.floor(height * (brandingConfig.logoPosition?.y || 0.05));
      const logoSize = Math.floor(width * (brandingConfig.logoSize || 0.12));
      filters.push(
        `[${logoIdx}:v]scale=${logoSize}:-1[logo]`,
        `[vt0][logo]overlay=${logoX}:${logoY}[vmain]`
      );
    } else {
      filters.push(`[vt0]null[vmain]`);
    }

    // 인트로/아웃트로 연결
    if (introEnabled || outroEnabled) {
      let concatInputs = [];
      let concatCount = 0;
      if (introEnabled) { concatInputs.push('[intro]'); concatCount++; }
      concatInputs.push('[vmain]'); concatCount++;
      if (outroEnabled) { concatInputs.push('[outro]'); concatCount++; }
      filters.push(`${concatInputs.join('')}concat=n=${concatCount}:v=1:a=0[vout]`);
    } else {
      filters.push(`[vmain]null[vout]`);
    }
  } else {
    let prevOutput = 'vt0';

    // 누적 duration 기반 offset 계산 (동적 duration 지원)
    let cumulativeDuration = getPhotoDuration(photos[0]);

    for (let i = 1; i < photoCount; i++) {
      // offset = 이전 클립들의 총 길이 - 누적 전환 시간
      const offset = cumulativeDuration - transitionDuration;
      const outputLabel = i === photoCount - 1 ? 'vmerged' : `vx${i}`;

      // 전환 모드에 따라 전환 효과 선택 (인덱스는 0부터)
      const xfadeTransition = selectTransition(i - 1, transitionMode, transition);

      filters.push(
        `[${prevOutput}][vt${i}]xfade=transition=${xfadeTransition}:duration=${transitionDuration}:offset=${offset}[${outputLabel}]`
      );
      prevOutput = outputLabel;

      // 다음 클립 duration 누적
      cumulativeDuration += getPhotoDuration(photos[i]) - transitionDuration;
    }

    // 4. Add logo overlay if enabled
    if (logoEnabled) {
      const logoIdx = photoCount;
      const logoX = Math.floor(width * (brandingConfig.logoPosition?.x || 0.92) - (width * (brandingConfig.logoSize || 0.12) / 2));
      const logoY = Math.floor(height * (brandingConfig.logoPosition?.y || 0.05));
      const logoSize = Math.floor(width * (brandingConfig.logoSize || 0.12));

      filters.push(
        `[${logoIdx}:v]scale=${logoSize}:-1[logo]`,
        `[vmerged][logo]overlay=${logoX}:${logoY}[vmain]`
      );
    } else {
      filters.push(`[vmerged]null[vmain]`);
    }

    // 5. 인트로/아웃트로 연결
    if (introEnabled || outroEnabled) {
      let concatInputs = [];
      let concatCount = 0;

      if (introEnabled) {
        concatInputs.push('[intro]');
        concatCount++;
      }

      concatInputs.push('[vmain]');
      concatCount++;

      if (outroEnabled) {
        concatInputs.push('[outro]');
        concatCount++;
      }

      filters.push(
        `${concatInputs.join('')}concat=n=${concatCount}:v=1:a=0[vout]`
      );
    } else {
      filters.push(`[vmain]null[vout]`);
    }
  }

  // Build FFmpeg arguments
  const args = [
    '-y', // Overwrite output
    ...inputArgs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]'
  ];

  // Audio handling (High Quality)
  if (bgmEnabled) {
    const audioIdx = logoEnabled ? photoCount + 1 : photoCount;
    args.push('-map', `${audioIdx}:a`);
    // 오디오 필터: 페이드인 + 볼륨 정규화
    args.push('-af', 'afade=t=in:st=0:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=11');
    args.push(
      '-c:a', 'aac',
      '-b:a', '256k',            // 128k -> 256k (고품질)
      '-ar', '48000',            // 48kHz 샘플레이트
      '-ac', '2',                // 스테레오
      '-shortest'
    );
  } else {
    args.push('-an');
  }

  // Video encoding (High Quality)
  args.push(
    '-c:v', 'libx264',
    '-preset', 'slow',           // 최고 압축 효율
    '-crf', '18',                // 고품질 (18-23 범위, 낮을수록 고품질)
    '-profile:v', 'high',        // H.264 High Profile
    '-level', '4.2',             // Level 4.2 (1080p@60fps 지원)
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',   // 웹 스트리밍 최적화 (moov atom을 앞으로)
    '-b:v', '8M',                // 8Mbps 비트레이트
    '-maxrate', '10M',           // 최대 비트레이트
    '-bufsize', '16M',           // 버퍼 크기
    outputPath
  );

  // Run FFmpeg
  await runFFmpeg(args);

  return outputPath;
}

/**
 * Generate video with simple concat (fallback, faster but no effects)
 */
export async function generateVideoSimple(photos, options = {}) {
  const { outputPath, bgmPath, config } = options;
  const videoConfig = config.video;

  mkdirSync(dirname(outputPath), { recursive: true });

  const duration = videoConfig.photoDuration || 3;
  const width = videoConfig.width || 1080;
  const height = videoConfig.height || 1920;
  const fps = videoConfig.fps || 30;

  // Create input file list for FFmpeg concat
  const listFile = join(dirname(outputPath), 'input_list.txt');
  const listContent = photos.map(p =>
    `file '${p.localPath.replace(/\\/g, '/')}'`
  ).join('\n');
  writeFileSync(listFile, listContent);

  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-vf', `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,loop=loop=${duration * fps}:size=1:start=0`,
    '-c:v', 'libx264',
    '-preset', 'slow',           // 고품질
    '-crf', '18',                // 고품질
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-b:v', '8M',
    '-maxrate', '10M',
    '-bufsize', '16M'
  ];

  if (bgmPath && existsSync(bgmPath)) {
    args.push('-i', bgmPath);
    args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest');
  } else {
    args.push('-an');
  }

  args.push(outputPath);

  await runFFmpeg(args);

  try { unlinkSync(listFile); } catch (e) { /* ignore */ }

  return outputPath;
}

/**
 * Get available transitions
 */
export const TRANSITIONS = [
  'directionalwipe',
  'fade',
  'crossfade',
  'slideright',
  'slideleft',
  'slideup',
  'slidedown',
  'radial',
  'circleopen',
  'directional'
];

// Re-export intro/outro for convenience
export { INTRO_OUTRO_PRESETS, INTRO_OUTRO_PRESET_NAMES };
