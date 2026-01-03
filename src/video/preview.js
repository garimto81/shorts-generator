import { dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import {
  formatSubtitle,
  splitAtMeaningfulBoundary,
  calculateDynamicFontSize
} from './subtitle.js';
import { SUBTITLE_POSITIONS, SUBTITLE_STYLES } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run FFmpeg command (silent mode for preview)
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
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
 * Get transition filter
 */
function getTransitionFilter(transition) {
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
 * Preview configuration presets
 */
export const PREVIEW_PRESETS = {
  fast: {
    name: '빠른 미리보기',
    width: 360,
    height: 640,
    fps: 15,
    crf: 35,
    preset: 'ultrafast'
  },
  balanced: {
    name: '균형 미리보기',
    width: 540,
    height: 960,
    fps: 24,
    crf: 30,
    preset: 'veryfast'
  },
  quality: {
    name: '고품질 미리보기',
    width: 720,
    height: 1280,
    fps: 30,
    crf: 28,
    preset: 'fast'
  }
};

/**
 * Generate preview video (low resolution, fast encoding)
 *
 * @param {Array} photos - Array of photo objects with localPath and title
 * @param {Object} options - Generation options
 * @param {string} options.outputPath - Output video path (optional, auto-generated)
 * @param {Object} options.config - Video configuration
 * @param {string} options.quality - Preview quality: 'fast', 'balanced', 'quality' (default: 'fast')
 * @returns {Promise<string>} Output preview path
 */
export async function generatePreview(photos, options = {}) {
  const { config, quality = 'fast' } = options;
  const videoConfig = config.video || {};
  const subtitleConfig = config.subtitle || {};
  const templateConfig = config.template || {};

  // Get preview preset
  const preset = PREVIEW_PRESETS[quality] || PREVIEW_PRESETS.fast;

  // Generate output path if not provided
  let outputPath = options.outputPath;
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outputPath = join(process.cwd(), 'output', `preview_${timestamp}.mp4`);
  }

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const duration = videoConfig.photoDuration || 3;
  const width = preset.width;
  const height = preset.height;
  const fps = preset.fps;
  const transitionDuration = Math.min(videoConfig.transitionDuration || 0.5, 0.3); // Shorter transitions for preview
  const transition = videoConfig.transition || 'fade';

  // Template settings
  const useKenBurns = templateConfig.kenBurns !== false;
  const zoomIntensity = (templateConfig.zoomIntensity ?? 0.15) * 0.7; // Reduced for preview
  const subtitlePosition = templateConfig.subtitlePosition || 'bottom';
  const subtitleStyleName = templateConfig.subtitleStyle || 'default';
  const subtitleStyle = SUBTITLE_STYLES[subtitleStyleName] || SUBTITLE_STYLES.default;

  // Build input arguments
  const inputArgs = [];
  photos.forEach(photo => {
    inputArgs.push('-loop', '1', '-framerate', '1', '-t', '1', '-i', photo.localPath);
  });

  // Build filter_complex
  const filters = [];
  const photoCount = photos.length;

  // 1. Scale and optional Ken Burns effect
  for (let i = 0; i < photoCount; i++) {
    if (useKenBurns && zoomIntensity > 0) {
      const zoomDirection = i % 2 === 0 ? 'in' : 'out';
      const zoomStart = zoomDirection === 'in' ? 1.0 : (1.0 + zoomIntensity);
      const zoomEnd = zoomDirection === 'in' ? (1.0 + zoomIntensity) : 1.0;
      const zoomExpr = `${zoomStart}+(${zoomEnd}-${zoomStart})*on/(${duration}*${fps})`;

      filters.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
        `crop=${width * 2}:${height * 2},` +
        `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=${width}x${height}:fps=${fps},` +
        `setsar=1[v${i}]`
      );
    } else {
      filters.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
        `loop=loop=${duration * fps}:size=1:start=0,` +
        `setpts=PTS-STARTPTS,fps=${fps},setsar=1[v${i}]`
      );
    }
  }

  // 2. Add subtitles (simplified for preview)
  for (let i = 0; i < photoCount; i++) {
    const photo = photos[i];
    // 자막 우선순위: finalSubtitle (AI) > title > groupTitle
    const subtitleText = photo.finalSubtitle || photo.title || photo.groupTitle || '';

    // 의미 단위 줄바꿈 적용 (2배 폰트에 맞춰 12자 기준)
    const subtitle = subtitleText
      ? splitAtMeaningfulBoundary(subtitleText, 12, { maxLines: 3 })
      : '';

    if (subtitle) {
      // 폰트 경로를 절대 경로로 변환 (FFmpeg 호환) - NotoSansKR-Black (900, 가장 굵음)
      let fontPath = subtitleConfig.font || './assets/fonts/NotoSansKR-Black.ttf';
      if (fontPath.startsWith('./')) {
        fontPath = join(__dirname, '../..', fontPath.slice(2));
      }
      // FFmpeg drawtext: 백슬래시→슬래시, 모든 콜론 이스케이프 (드라이브 문자 포함)
      fontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

      // 동적 폰트 크기 계산 (100px 기준, 70% 축소)
      const baseFontSize = subtitleConfig.fontSize || subtitleStyle.fontSize || 100;
      const dynamicSize = calculateDynamicFontSize(subtitleText, {
        baseSize: baseFontSize,
        minSize: 68,
        maxLength: 12
      });
      const fontSize = Math.floor(dynamicSize * (width / 1080));

      const textColor = hexToFFmpegColor(subtitleConfig.textColor || '#FFFFFF');
      // 테두리 (4px - Black 폰트에 맞춤)
      const borderWidth = Math.max(2, Math.floor((subtitleStyle.borderWidth || 4) * (width / 1080)));
      const escapedText = escapeText(subtitle);
      const yPos = SUBTITLE_POSITIONS[subtitlePosition] || SUBTITLE_POSITIONS.bottom;

      // 그림자 효과 추가
      const hasShadow = subtitleStyle.shadow !== false;
      let drawtextParams = `fontfile='${fontPath}':text='${escapedText}':` +
        `fontsize=${fontSize}:fontcolor=${textColor}:` +
        `borderw=${borderWidth}:bordercolor=black:` +
        `x=(w-text_w)/2:y=${yPos}`;

      if (hasShadow) {
        const shadowX = Math.max(1, Math.floor((subtitleStyle.shadowX || 4) * (width / 1080)));
        const shadowY = Math.max(1, Math.floor((subtitleStyle.shadowY || 4) * (width / 1080)));
        const shadowColor = subtitleStyle.shadowColor || '0x000000AA';
        drawtextParams += `:shadowx=${shadowX}:shadowy=${shadowY}:shadowcolor=${shadowColor}`;
      }

      filters.push(`[v${i}]drawtext=${drawtextParams}[vt${i}]`);
    } else {
      filters.push(`[v${i}]null[vt${i}]`);
    }
  }

  // 3. Apply transitions
  if (photoCount === 1) {
    filters.push(`[vt0]null[vout]`);
  } else {
    const xfadeTransition = getTransitionFilter(transition);
    let prevOutput = 'vt0';

    for (let i = 1; i < photoCount; i++) {
      const offset = (i * duration) - (i * transitionDuration);
      const outputLabel = i === photoCount - 1 ? 'vout' : `vx${i}`;

      filters.push(
        `[${prevOutput}][vt${i}]xfade=transition=${xfadeTransition}:duration=${transitionDuration}:offset=${offset}[${outputLabel}]`
      );
      prevOutput = outputLabel;
    }
  }

  // Build FFmpeg arguments (optimized for speed)
  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    '-an', // No audio for preview
    '-c:v', 'libx264',
    '-preset', preset.preset,
    '-crf', preset.crf.toString(),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath
  ];

  await runFFmpeg(args);

  return outputPath;
}

/**
 * Get estimated preview generation time
 * @param {number} photoCount - Number of photos
 * @param {string} quality - Preview quality preset
 * @returns {string} Estimated time string
 */
export function estimatePreviewTime(photoCount, quality = 'fast') {
  const baseTimePerPhoto = {
    fast: 2,
    balanced: 4,
    quality: 6
  };

  const seconds = photoCount * (baseTimePerPhoto[quality] || 2);

  if (seconds < 60) {
    return `~${seconds}초`;
  }
  return `~${Math.ceil(seconds / 60)}분`;
}
