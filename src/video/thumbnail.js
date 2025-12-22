import { spawn } from 'child_process';
import { dirname, basename, join } from 'path';
import { mkdirSync } from 'fs';

/**
 * Get video duration using ffprobe
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} Duration in seconds
 */
export async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ];

    const ffprobe = spawn('ffprobe', args);
    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    ffprobe.on('error', reject);
  });
}

/**
 * Calculate seek position based on option
 * @param {string|number} position - 'start', 'middle', 'end', or seconds
 * @param {number} duration - Video duration in seconds
 * @returns {number} Seek position in seconds
 */
function calculateSeekPosition(position, duration) {
  if (typeof position === 'number') {
    return Math.min(position, duration);
  }

  switch (position) {
    case 'start':
      return 0;
    case 'end':
      return Math.max(0, duration - 0.5);
    case 'middle':
    default:
      return duration / 2;
  }
}

/**
 * Generate thumbnail from video
 * @param {string} videoPath - Path to the video file
 * @param {string} outputPath - Output thumbnail path (optional, auto-generated if not provided)
 * @param {Object} options - Generation options
 * @param {string|number} options.position - 'start', 'middle', 'end', or seconds (default: 'middle')
 * @param {number} options.width - Thumbnail width (default: 1080)
 * @param {number} options.height - Thumbnail height (default: 1920)
 * @param {number} options.quality - JPEG quality 1-31, lower is better (default: 2)
 * @returns {Promise<string>} Output thumbnail path
 */
export async function generateThumbnail(videoPath, outputPath = null, options = {}) {
  const {
    position = 'middle',
    width = 1080,
    height = 1920,
    quality = 2
  } = options;

  // Generate output path if not provided
  if (!outputPath) {
    const dir = dirname(videoPath);
    const name = basename(videoPath, '.mp4');
    outputPath = join(dir, `${name}_thumb.jpg`);
  }

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Get video duration for position calculation
  const duration = await getVideoDuration(videoPath);
  const seekPos = calculateSeekPosition(position, duration);

  // Build FFmpeg arguments
  const args = [
    '-y',
    '-ss', seekPos.toString(),
    '-i', videoPath,
    '-vframes', '1',
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
    '-q:v', quality.toString(),
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg thumbnail extraction failed with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}
