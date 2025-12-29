import { spawn } from 'child_process';
import { dirname, basename, join } from 'path';
import { mkdirSync, existsSync, unlinkSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
 * 텍스트 오버레이 스타일 프리셋
 */
export const TEXT_OVERLAY_STYLES = {
  // 기본 스타일 - 하단 중앙
  default: {
    position: 'bottom',  // top, center, bottom
    fontSize: 60,
    fontColor: '0xFFFFFF',
    backgroundColor: '0x00000099',
    padding: 20
  },
  // 상단 배너 스타일
  banner: {
    position: 'top',
    fontSize: 50,
    fontColor: '0xFFFFFF',
    backgroundColor: '0x000000CC',
    padding: 25
  },
  // 중앙 강조 스타일
  centered: {
    position: 'center',
    fontSize: 80,
    fontColor: '0xFFFFFF',
    backgroundColor: '0x00000080',
    padding: 30
  },
  // 미니멀 스타일 (배경 없음)
  minimal: {
    position: 'bottom',
    fontSize: 55,
    fontColor: '0xFFFFFF',
    backgroundColor: null,
    padding: 0,
    shadow: true
  }
};

/**
 * 텍스트 위치 계산
 * @param {string} position - 위치 ('top', 'center', 'bottom')
 * @param {number} height - 영상 높이
 * @returns {string} FFmpeg y 표현식
 */
function getTextYPosition(position, height) {
  switch (position) {
    case 'top':
      return 'h/10';
    case 'center':
      return '(h-text_h)/2';
    case 'bottom':
    default:
      return 'h-h/8';
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
 * @param {string} options.text - 텍스트 오버레이 (옵션)
 * @param {string} options.textStyle - 텍스트 스타일 (default/banner/centered/minimal)
 * @param {string} options.fontPath - 폰트 경로
 * @returns {Promise<string>} Output thumbnail path
 */
export async function generateThumbnail(videoPath, outputPath = null, options = {}) {
  const {
    position = 'middle',
    width = 1080,
    height = 1920,
    quality = 2,
    text = null,
    textStyle = 'default',
    fontPath = null
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

  // Build video filter
  let vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;

  // 텍스트 오버레이 추가
  if (text) {
    const style = TEXT_OVERLAY_STYLES[textStyle] || TEXT_OVERLAY_STYLES.default;

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

    const yPos = getTextYPosition(style.position, height);

    // 배경 박스가 있는 경우
    if (style.backgroundColor) {
      vf += `,drawtext=fontfile='${font}':text='${escapedText}':` +
        `fontsize=${style.fontSize}:fontcolor=${style.fontColor}:` +
        `x=(w-text_w)/2:y=${yPos}:` +
        `box=1:boxcolor=${style.backgroundColor}:boxborderw=${style.padding}`;
    } else {
      // 배경 없이 그림자만
      vf += `,drawtext=fontfile='${font}':text='${escapedText}':` +
        `fontsize=${style.fontSize}:fontcolor=${style.fontColor}:` +
        `x=(w-text_w)/2:y=${yPos}:` +
        `shadowx=3:shadowy=3:shadowcolor=0x000000AA`;
    }
  }

  // Build FFmpeg arguments
  const args = [
    '-y',
    '-ss', seekPos.toString(),
    '-i', videoPath,
    '-vframes', '1',
    '-vf', vf,
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

/**
 * 여러 후보 중 최적 썸네일 선택
 * 파일 크기를 기준으로 선택 (더 큰 파일 = 더 많은 디테일/대비)
 * @param {string} videoPath - 비디오 경로
 * @param {string} outputPath - 출력 경로
 * @param {Object} options - 옵션
 * @param {number} options.candidates - 후보 개수 (기본 5)
 * @returns {Promise<string>} 최적 썸네일 경로
 */
export async function generateBestThumbnail(videoPath, outputPath = null, options = {}) {
  const {
    candidates = 5,
    width = 1080,
    height = 1920,
    quality = 2,
    text = null,
    textStyle = 'default',
    fontPath = null
  } = options;

  // Generate output path if not provided
  if (!outputPath) {
    const dir = dirname(videoPath);
    const name = basename(videoPath, '.mp4');
    outputPath = join(dir, `${name}_thumb.jpg`);
  }

  const duration = await getVideoDuration(videoPath);
  const tempDir = dirname(outputPath);

  // 후보 위치 계산 (영상 전체에 균등 분포)
  const positions = [];
  for (let i = 0; i < candidates; i++) {
    // 시작과 끝 10%는 제외
    const pos = duration * (0.1 + (0.8 * i / (candidates - 1)));
    positions.push(pos);
  }

  // 각 위치에서 임시 썸네일 생성
  const tempFiles = [];
  for (let i = 0; i < positions.length; i++) {
    const tempPath = join(tempDir, `_thumb_candidate_${i}.jpg`);
    tempFiles.push(tempPath);

    await generateThumbnail(videoPath, tempPath, {
      position: positions[i],
      width,
      height,
      quality,
      // 텍스트는 최종 선택 후 적용
    });
  }

  // 파일 크기로 최적 후보 선택 (더 큰 파일 = 더 많은 디테일)
  let bestIndex = 0;
  let bestSize = 0;

  for (let i = 0; i < tempFiles.length; i++) {
    try {
      const stat = statSync(tempFiles[i]);
      if (stat.size > bestSize) {
        bestSize = stat.size;
        bestIndex = i;
      }
    } catch (e) {
      // 파일이 없으면 스킵
    }
  }

  // 최적 후보를 최종 출력으로 복사 (텍스트 오버레이 포함)
  const bestPosition = positions[bestIndex];

  // 텍스트가 있으면 다시 생성, 없으면 최적 후보 이동
  if (text) {
    await generateThumbnail(videoPath, outputPath, {
      position: bestPosition,
      width,
      height,
      quality,
      text,
      textStyle,
      fontPath
    });
  } else {
    // 최적 후보를 최종 위치로 이동
    const { renameSync } = await import('fs');
    renameSync(tempFiles[bestIndex], outputPath);
  }

  // 임시 파일 정리
  for (const tempFile of tempFiles) {
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch (e) {
      // 무시
    }
  }

  return outputPath;
}
