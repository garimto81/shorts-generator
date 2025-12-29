import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { formatSubtitle, SUBTITLE_STYLE } from './subtitle.js';
import { SUBTITLE_POSITIONS, SUBTITLE_STYLES } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Ken Burns 패턴 정의
 * 각 패턴은 zoompan 필터의 z(줌), x(수평 위치), y(수직 위치) 표현식을 생성
 */
const KEN_BURNS_PATTERNS = {
  // 기본 줌 인 (중앙)
  zoomInCenter: (duration, fps, intensity) => ({
    z: `1.0+(${intensity})*on/(${duration}*${fps})`,
    x: 'iw/2-(iw/zoom/2)',
    y: 'ih/2-(ih/zoom/2)'
  }),
  // 기본 줌 아웃 (중앙)
  zoomOutCenter: (duration, fps, intensity) => ({
    z: `(1.0+${intensity})-(${intensity})*on/(${duration}*${fps})`,
    x: 'iw/2-(iw/zoom/2)',
    y: 'ih/2-(ih/zoom/2)'
  }),
  // 좌상단에서 우하단으로 패닝 + 줌 인
  panLeftTopToRightBottom: (duration, fps, intensity) => ({
    z: `1.0+(${intensity})*on/(${duration}*${fps})`,
    x: `(iw*0.1)+(iw*0.3)*on/(${duration}*${fps})`,
    y: `(ih*0.1)+(ih*0.3)*on/(${duration}*${fps})`
  }),
  // 우상단에서 좌하단으로 패닝 + 줌 인
  panRightTopToLeftBottom: (duration, fps, intensity) => ({
    z: `1.0+(${intensity})*on/(${duration}*${fps})`,
    x: `(iw*0.4)-(iw*0.3)*on/(${duration}*${fps})`,
    y: `(ih*0.1)+(ih*0.3)*on/(${duration}*${fps})`
  }),
  // 좌우 패닝 (줌 고정)
  panLeftToRight: (duration, fps, intensity) => ({
    z: `1.0+${intensity * 0.5}`,
    x: `(iw*0.1)+(iw*0.3)*on/(${duration}*${fps})`,
    y: 'ih/2-(ih/zoom/2)'
  }),
  // 우좌 패닝 (줌 고정)
  panRightToLeft: (duration, fps, intensity) => ({
    z: `1.0+${intensity * 0.5}`,
    x: `(iw*0.4)-(iw*0.3)*on/(${duration}*${fps})`,
    y: 'ih/2-(ih/zoom/2)'
  }),
  // 상하 패닝 + 줌 아웃
  panTopToBottom: (duration, fps, intensity) => ({
    z: `(1.0+${intensity})-(${intensity * 0.5})*on/(${duration}*${fps})`,
    x: 'iw/2-(iw/zoom/2)',
    y: `(ih*0.15)+(ih*0.2)*on/(${duration}*${fps})`
  }),
  // 하상 패닝 + 줌 인
  panBottomToTop: (duration, fps, intensity) => ({
    z: `1.0+(${intensity * 0.5})*on/(${duration}*${fps})`,
    x: 'iw/2-(iw/zoom/2)',
    y: `(ih*0.35)-(ih*0.2)*on/(${duration}*${fps})`
  })
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
 * Get transition filter between two clips
 * @param {string} transition - Transition type
 * @param {number} duration - Transition duration in seconds
 * @returns {string} FFmpeg xfade filter string
 */
function getTransitionFilter(transition, duration) {
  const transitions = {
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
  return transitions[transition] || 'fade';
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

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const defaultDuration = videoConfig.photoDuration || 3;
  const width = videoConfig.width || 1080;
  const height = videoConfig.height || 1920;
  const fps = videoConfig.fps || 30;
  const transitionDuration = videoConfig.transitionDuration || 0.5;
  const transition = videoConfig.transition || 'fade';

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

  // 1. Scale and Ken Burns effect for each photo
  for (let i = 0; i < photoCount; i++) {
    const photo = photos[i];
    const photoDuration = getPhotoDuration(photo);

    if (useKenBurns && zoomIntensity > 0) {
      // Ken Burns: 다양한 패턴 적용 (zoom + pan 조합)
      const effect = getKenBurnsEffect(i, photoDuration, fps, zoomIntensity, kenBurnsMode);

      // Scale with Ken Burns (zoompan)
      filters.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
        `crop=${width * 2}:${height * 2},` +
        `zoompan=z='${effect.z}':x='${effect.x}':y='${effect.y}':d=${photoDuration * fps}:s=${width}x${height}:fps=${fps},` +
        `setsar=1[v${i}]`
      );
    } else {
      // No Ken Burns - simple scale and duration
      filters.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
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

      filters.push(`[v${i}]drawtext=${drawtextParams}[vt${i}]`);
    } else {
      filters.push(`[v${i}]null[vt${i}]`);
    }
  }

  // 3. Apply transitions between clips using xfade
  if (photoCount === 1) {
    filters.push(`[vt0]null[vout]`);
  } else {
    const xfadeTransition = getTransitionFilter(transition, transitionDuration);
    let prevOutput = 'vt0';

    // 누적 duration 기반 offset 계산 (동적 duration 지원)
    let cumulativeDuration = getPhotoDuration(photos[0]);

    for (let i = 1; i < photoCount; i++) {
      // offset = 이전 클립들의 총 길이 - 누적 전환 시간
      const offset = cumulativeDuration - transitionDuration;
      const outputLabel = i === photoCount - 1 ? 'vmerged' : `vx${i}`;

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
        `[vmerged][logo]overlay=${logoX}:${logoY}[vout]`
      );
    } else {
      filters.push(`[vmerged]null[vout]`);
    }
  }

  // Build FFmpeg arguments
  const args = [
    '-y', // Overwrite output
    ...inputArgs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]'
  ];

  // Audio handling
  if (bgmEnabled) {
    const audioIdx = logoEnabled ? photoCount + 1 : photoCount;
    args.push('-map', `${audioIdx}:a`);
    // 오디오 페이드인 적용 (시작 잡음 제거)
    args.push('-af', 'afade=t=in:st=0:d=0.5');
    args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
  } else {
    args.push('-an');
  }

  // Video encoding
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
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
    '-vf', `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,loop=loop=${duration * fps}:size=1:start=0`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p'
  ];

  if (bgmPath && existsSync(bgmPath)) {
    args.push('-i', bgmPath);
    args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
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
