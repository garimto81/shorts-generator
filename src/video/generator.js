import editly from 'editly';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { formatSubtitle } from './subtitle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Generate a marketing video from photos using Editly/FFmpeg
 * @param {Array} photos - Array of photo objects with localPath and title
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Output video path
 */
export async function generateVideo(photos, options = {}) {
  const { outputPath, bgmPath, logoPath, config } = options;
  const videoConfig = config.video;
  const subtitleConfig = config.subtitle || {};
  const brandingConfig = config.branding || {};

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Resolve font path
  const fontPath = subtitleConfig.font
    ? join(__dirname, '../../', subtitleConfig.font)
    : join(__dirname, '../../assets/fonts/NotoSansKR-Bold.otf');

  // Build clips with Ken Burns effect and subtitles
  const clips = photos.map((photo, index) => {
    const layers = [
      // Background image with Ken Burns zoom
      {
        type: 'image',
        path: photo.localPath,
        zoomDirection: index % 2 === 0 ? 'in' : 'out',
        zoomAmount: 0.1
      }
    ];

    // Add subtitle if title exists
    if (photo.title) {
      layers.push({
        type: 'title',
        text: formatSubtitle(photo.title, 15),
        fontPath: existsSync(fontPath) ? fontPath : undefined,
        fontSize: subtitleConfig.fontSize || 60,
        textColor: subtitleConfig.textColor || '#FFFFFF',
        position: { y: 0.85 }
      });
    }

    return {
      duration: videoConfig.photoDuration,
      layers
    };
  });

  // Build Editly config
  const editlyConfig = {
    outPath: outputPath,
    width: videoConfig.width,
    height: videoConfig.height,
    fps: videoConfig.fps,
    clips,
    defaults: {
      transition: {
        name: videoConfig.transition || 'directionalwipe',
        duration: videoConfig.transitionDuration || 0.5
      }
    }
  };

  // Add BGM audio track
  const audioBgm = bgmPath || (config.audio?.defaultBgm);
  if (audioBgm && existsSync(audioBgm)) {
    editlyConfig.audioTracks = [{
      path: audioBgm,
      mixVolume: config.audio?.bgmVolume || 0.3,
      loop: true
    }];
  }

  // Add logo overlay (appears on all clips)
  const resolvedLogoPath = logoPath || (brandingConfig.enabled && brandingConfig.logo
    ? join(__dirname, '../../', brandingConfig.logo)
    : null);

  if (resolvedLogoPath && existsSync(resolvedLogoPath)) {
    // Add logo to each clip
    clips.forEach(clip => {
      clip.layers.push({
        type: 'image',
        path: resolvedLogoPath,
        position: brandingConfig.logoPosition || { x: 0.92, y: 0.05 },
        width: brandingConfig.logoSize || 0.12
      });
    });
  }

  // Execute Editly
  await editly(editlyConfig);

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
