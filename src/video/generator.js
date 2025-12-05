import editly from 'editly';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateVideo(photos, options = {}) {
  const { outputPath, bgmPath, config } = options;
  const videoConfig = config.video;

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const clips = photos.map((photo, index) => ({
    duration: videoConfig.photoDuration,
    layers: [
      {
        type: 'image',
        path: photo.localPath,
        zoomDirection: index % 2 === 0 ? 'in' : 'out',
        zoomAmount: 0.1
      },
      {
        type: 'title',
        text: photo.title,
        fontPath: join(__dirname, '../../assets/fonts/NotoSansKR-Bold.otf'),
        fontSize: 60,
        textColor: '#FFFFFF',
        position: { y: 0.85 }
      }
    ]
  }));

  const editlyConfig = {
    outPath: outputPath,
    width: videoConfig.width,
    height: videoConfig.height,
    fps: videoConfig.fps,
    clips,
    defaults: {
      transition: {
        name: videoConfig.transition,
        duration: videoConfig.transitionDuration
      }
    }
  };

  // Add BGM if provided
  if (bgmPath) {
    editlyConfig.audioTracks = [{
      path: bgmPath,
      mixVolume: config.audio.bgmVolume,
      loop: true
    }];
  }

  await editly(editlyConfig);

  return outputPath;
}
