import PocketBase from 'pocketbase';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../../config.json'), 'utf-8'));

const API_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;
const AUTH_CONFIG = config.pocketbase.auth;

// PocketBase 클라이언트 초기화
const pb = new PocketBase(API_URL);

let isAuthenticated = false;

/**
 * Admin 로그인 (PocketBase SDK 사용)
 */
async function authenticate() {
  if (isAuthenticated) return;

  if (!AUTH_CONFIG?.email || !AUTH_CONFIG?.password) {
    console.warn('인증 정보 없음, 비인증 모드로 진행');
    return;
  }

  try {
    // PocketBase v0.23+: admins -> _superusers collection
    await pb.collection('_superusers').authWithPassword(
      AUTH_CONFIG.email,
      AUTH_CONFIG.password
    );
    isAuthenticated = true;
    console.log('✓ PocketBase 로그인 성공');
  } catch (err) {
    console.warn('Admin 로그인 실패:', err.message);
  }
}

/**
 * 사진 목록 조회
 */
export async function fetchPhotos(options = {}) {
  const { limit = 50, since = null } = options;

  // 공개 API로 먼저 시도, 실패 시 인증 후 재시도
  const queryOptions = {};
  if (since) {
    queryOptions.filter = `created >= "${since}"`;
  }

  let records;
  try {
    records = await pb.collection(COLLECTION).getList(1, limit, queryOptions);
  } catch (err) {
    // 인증 필요 시 재시도
    await authenticate();
    records = await pb.collection(COLLECTION).getList(1, limit, queryOptions);
  }

  return records.items.map(item => ({
    id: item.id,
    title: item.title,
    imageUrl: item.image ? pb.files.getURL(item, item.image) : null,
    thumbnailUrl: item.thumbnail ? pb.files.getURL(item, item.thumbnail) : null,
    created: item.created
  }));
}

/**
 * 이미지 다운로드
 */
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

/**
 * PocketBase 클라이언트 인스턴스 내보내기 (확장 용도)
 */
export { pb };
