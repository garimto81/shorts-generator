import PocketBase from 'pocketbase';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sortPhotos, SORT_MODES } from '../utils/photo-sorter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../../config.json'), 'utf-8'));

const API_URL = process.env.POCKETBASE_URL || config.pocketbase.url;
const COLLECTION = config.pocketbase.collection;

// 환경변수 우선, config.json 폴백
const AUTH_CONFIG = {
  email: process.env.POCKETBASE_EMAIL || config.pocketbase.auth?.email || null,
  password: process.env.POCKETBASE_PASSWORD || config.pocketbase.auth?.password || null
};

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
 * 정렬 옵션을 PocketBase 형식으로 변환
 * @param {string} sort - 정렬 옵션 (newest|oldest|title|title-desc 또는 PocketBase 형식)
 * @returns {string} PocketBase 정렬 문자열
 */
function parseSortOption(sort) {
  // PocketHost에서 created 필드 정렬 불가 → id 기반 정렬 사용
  const sortMap = {
    'newest': '-id',
    'oldest': '+id',
    'title': '+title',
    'title-desc': '-title'
  };
  return sortMap[sort] || sort;
}

/**
 * 그룹 목록 조회
 * @param {Object} options - { limit, sort }
 * @returns {Promise<Array>} 그룹 배열
 */
export async function fetchGroups(options = {}) {
  const { limit = 20, sort = 'newest' } = options;

  const queryOptions = {
    sort: parseSortOption(sort)
  };

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
 * @param {Object} options - { limit, sort, filenameSort }
 * @returns {Promise<Array>} 사진 배열
 */
export async function fetchPhotosByGroup(groupId, options = {}) {
  const { limit = 50, sort = 'newest', filenameSort = 'filename' } = options;

  const queryOptions = {
    filter: `group = "${groupId}"`,
    sort: parseSortOption(sort)
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

  let photos = records.items.map(item => ({
    id: item.id,
    title: item.title,
    image: item.image,  // 파일명 (정렬용)
    groupId: item.group || null,
    groupTitle: groupTitle,
    imageUrl: item.image ? pb.files.getURL(item, item.image) : null,
    thumbnailUrl: item.thumbnail ? pb.files.getURL(item, item.thumbnail) : null
  }));

  // 파일명 기반 정렬 적용 (기본값: filename)
  if (filenameSort && filenameSort !== 'none') {
    photos = sortPhotos(photos, filenameSort);
  }

  return photos;
}

/**
 * 사진 목록 조회
 * @param {Object} options - { limit, groupId, sort, filenameSort }
 * @returns {Promise<Array>} 사진 배열
 */
export async function fetchPhotos(options = {}) {
  const { limit = 50, groupId = null, sort = 'newest', filenameSort = 'filename' } = options;

  const queryOptions = {
    sort: parseSortOption(sort)
  };

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

  let photos = records.items.map(item => ({
    id: item.id,
    title: item.title,
    image: item.image,  // 파일명 (정렬용)
    groupId: item.group || null,
    groupTitle: groupMap[item.group] || null,
    imageUrl: item.image ? pb.files.getURL(item, item.image) : null,
    thumbnailUrl: item.thumbnail ? pb.files.getURL(item, item.thumbnail) : null
  }));

  // 파일명 기반 정렬 적용 (기본값: filename)
  if (filenameSort && filenameSort !== 'none') {
    photos = sortPhotos(photos, filenameSort);
  }

  return photos;
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
