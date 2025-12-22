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
 * 그룹 목록 조회
 * @param {Object} options - { limit, since }
 * @returns {Promise<Array>} 그룹 배열
 */
export async function fetchGroups(options = {}) {
  const { limit = 20 } = options;

  const queryOptions = {};

  let records;
  try {
    records = await pb.collection('photo_groups').getList(1, limit, queryOptions);
  } catch (err) {
    await authenticate();
    records = await pb.collection('photo_groups').getList(1, limit, queryOptions);
  }

  return records.items.map(item => ({
    id: item.id,
    title: item.title
  }));
}

/**
 * 특정 그룹의 사진 목록 조회
 * @param {string} groupId - 그룹 ID
 * @param {Object} options - { limit }
 * @returns {Promise<Array>} 사진 배열
 */
export async function fetchPhotosByGroup(groupId, options = {}) {
  const { limit = 50 } = options;

  const queryOptions = {
    filter: `group = "${groupId}"`
  };

  let records;
  try {
    records = await pb.collection(COLLECTION).getList(1, limit, queryOptions);
  } catch (err) {
    await authenticate();
    records = await pb.collection(COLLECTION).getList(1, limit, queryOptions);
  }

  // 그룹 정보 조회
  let groupTitle = null;
  try {
    const group = await pb.collection('photo_groups').getOne(groupId);
    groupTitle = group.title;
  } catch (e) {
    // 그룹 조회 실패 시 무시
  }

  return records.items.map(item => ({
    id: item.id,
    title: item.title,
    groupId: item.group || null,
    groupTitle: groupTitle,
    imageUrl: item.image ? pb.files.getURL(item, item.image) : null,
    thumbnailUrl: item.thumbnail ? pb.files.getURL(item, item.thumbnail) : null
  }));
}

/**
 * 사진 목록 조회
 * @param {Object} options - { limit, since, groupId }
 * @returns {Promise<Array>} 사진 배열
 */
export async function fetchPhotos(options = {}) {
  const { limit = 50, groupId = null } = options;

  const queryOptions = {};

  if (groupId) {
    queryOptions.filter = `group = "${groupId}"`;
  }

  let records;
  try {
    records = await pb.collection(COLLECTION).getList(1, limit, queryOptions);
  } catch (err) {
    await authenticate();
    records = await pb.collection(COLLECTION).getList(1, limit, queryOptions);
  }

  // 그룹 정보 조회 (그룹 ID가 있는 사진만)
  const groupIds = [...new Set(records.items.map(item => item.group).filter(Boolean))];
  const groupMap = {};

  if (groupIds.length > 0) {
    try {
      const groupFilter = groupIds.map(id => `id = "${id}"`).join(' || ');
      const groups = await pb.collection('photo_groups').getList(1, groupIds.length, { filter: groupFilter });
      groups.items.forEach(g => { groupMap[g.id] = g.title; });
    } catch (e) {
      // 그룹 조회 실패 시 무시
    }
  }

  return records.items.map(item => ({
    id: item.id,
    title: item.title,
    groupId: item.group || null,
    groupTitle: groupMap[item.group] || null,
    imageUrl: item.image ? pb.files.getURL(item, item.image) : null,
    thumbnailUrl: item.thumbnail ? pb.files.getURL(item, item.thumbnail) : null
  }));
}

/**
 * 이미지 다운로드
 */
export async function downloadImage(photo, destDir) {
  mkdirSync(destDir, { recursive: true });

  if (!photo.imageUrl) {
    throw new Error(`Photo ${photo.id} has no image URL`);
  }

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
