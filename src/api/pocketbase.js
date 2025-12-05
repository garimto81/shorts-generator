import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../../config.json'), 'utf-8'));

const API_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;

export async function fetchPhotos(options = {}) {
  const { limit = 50, since = null } = options;

  let url = `${API_URL}/api/collections/${COLLECTION}/records?sort=-created&perPage=${limit}`;

  if (since) {
    url += `&filter=${encodeURIComponent(`created >= "${since}"`)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  return data.items.map(item => ({
    id: item.id,
    title: item.title,
    imageUrl: `${API_URL}/api/files/${COLLECTION}/${item.id}/${item.image}`,
    thumbnailUrl: item.thumbnail
      ? `${API_URL}/api/files/${COLLECTION}/${item.id}/${item.thumbnail}`
      : null,
    created: item.created
  }));
}

export async function downloadImage(photo, destDir) {
  mkdirSync(destDir, { recursive: true });

  const response = await fetch(photo.imageUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const filename = `${photo.id}.jpg`;
  const filepath = join(destDir, filename);

  writeFileSync(filepath, Buffer.from(buffer));

  return filepath;
}
