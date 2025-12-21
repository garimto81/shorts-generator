import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { formatSubtitle, SUBTITLE_STYLE } from './subtitle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run FFmpeg command
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log('FFmpeg command:', 'ffmpeg', args.join(' ').substring(0, 200) + '...');
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

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const duration = videoConfig.photoDuration || 3;
  const width = videoConfig.width || 1080;
  const height = videoConfig.height || 1920;
  const fps = videoConfig.fps || 30;
  const transitionDuration = videoConfig.transitionDuration || 0.5;
  const transition = videoConfig.transition || 'fade';

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

    // Ken Burns: alternating zoom in/out
    const zoomDirection = i % 2 === 0 ? 'in' : 'out';
    const zoomStart = zoomDirection === 'in' ? 1.0 : 1.15;
    const zoomEnd = zoomDirection === 'in' ? 1.15 : 1.0;
    const zoomExpr = `${zoomStart}+(${zoomEnd}-${zoomStart})*on/(${duration}*${fps})`;

    // Scale with Ken Burns (zoompan)
    filters.push(
      `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
      `crop=${width * 2}:${height * 2},` +
      `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=${width}x${height}:fps=${fps},` +
      `setsar=1[v${i}]`
    );
  }

  // 2. Add subtitles to each video segment
  for (let i = 0; i < photoCount; i++) {
    const photo = photos[i];
    const subtitle = photo.title ? formatSubtitle(photo.title, 15) : '';

    if (subtitle) {
      const fontPath = subtitleConfig.font || './assets/fonts/NotoSansKR-Bold.otf';
      const fontSize = subtitleConfig.fontSize || 60;
      const textColor = hexToFFmpegColor(subtitleConfig.textColor || '#FFFFFF');
      const escapedText = escapeText(subtitle);

      // Position: bottom center with padding
      const yPos = `h-h/10`;

      filters.push(
        `[v${i}]drawtext=fontfile='${fontPath}':text='${escapedText}':` +
        `fontsize=${fontSize}:fontcolor=${textColor}:` +
        `borderw=3:bordercolor=black:` +
        `x=(w-text_w)/2:y=${yPos}[vt${i}]`
      );
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

    for (let i = 1; i < photoCount; i++) {
      const offset = (i * duration) - (i * transitionDuration);
      const outputLabel = i === photoCount - 1 ? 'vmerged' : `vx${i}`;

      filters.push(
        `[${prevOutput}][vt${i}]xfade=transition=${xfadeTransition}:duration=${transitionDuration}:offset=${offset}[${outputLabel}]`
      );
      prevOutput = outputLabel;
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
