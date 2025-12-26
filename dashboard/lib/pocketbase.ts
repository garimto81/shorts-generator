import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Photo, PhotoGroup, FetchPhotosOptions, FetchGroupsOptions } from '@/types/photo';

// 상위 디렉토리의 config.json에서 설정 가져오기
interface Config {
  pocketbase: {
    url: string;
    collection: string;
    auth?: {
      email: string;
      password: string;
    };
  };
}

function loadConfig(): Config {
  try {
    const configPath = join(process.cwd(), '..', 'config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch {
    // 기본값 반환
    return {
      pocketbase: {
        url: process.env.POCKETBASE_URL || 'https://union-public.pockethost.io',
        collection: 'photos',
      },
    };
  }
}

const config = loadConfig();
const POCKETBASE_URL = config.pocketbase.url;
const COLLECTION = config.pocketbase.collection || 'photos';
const POCKETBASE_EMAIL = config.pocketbase.auth?.email || process.env.POCKETBASE_EMAIL || '';
const POCKETBASE_PASSWORD = config.pocketbase.auth?.password || process.env.POCKETBASE_PASSWORD || '';

let pb: PocketBase | null = null;
let isAuthenticated = false;

export function getPocketBase(): PocketBase {
  if (!pb) {
    pb = new PocketBase(POCKETBASE_URL);
    pb.autoCancellation(false);
  }
  return pb;
}

async function authenticate(): Promise<void> {
  if (isAuthenticated) return;

  const client = getPocketBase();

  if (POCKETBASE_EMAIL && POCKETBASE_PASSWORD) {
    try {
      // PocketBase v0.23+ uses _superusers collection
      await client.collection('_superusers').authWithPassword(
        POCKETBASE_EMAIL,
        POCKETBASE_PASSWORD
      );
      isAuthenticated = true;
      console.log('PocketBase authenticated successfully');
    } catch (error) {
      console.warn('PocketBase auth failed:', error);
    }
  }
}

export async function fetchGroups(options: FetchGroupsOptions = {}): Promise<PhotoGroup[]> {
  const client = getPocketBase();
  const { limit = 20 } = options;

  const queryOptions: Record<string, unknown> = {};

  let records;
  try {
    records = await client.collection('photo_groups').getList(1, limit, queryOptions);
  } catch {
    await authenticate();
    records = await client.collection('photo_groups').getList(1, limit, queryOptions);
  }

  return records.items.map(item => ({
    id: item.id,
    title: (item.title as string) || '',
    created: item.created,
  }));
}

export async function fetchPhotos(options: FetchPhotosOptions = {}): Promise<Photo[]> {
  const client = getPocketBase();
  const { limit = 20, groupId } = options;

  const queryOptions: Record<string, unknown> = {};

  if (groupId) {
    queryOptions.filter = `group = "${groupId}"`;
  }

  let records;
  try {
    records = await client.collection(COLLECTION).getList(1, limit, queryOptions);
  } catch {
    await authenticate();
    records = await client.collection(COLLECTION).getList(1, limit, queryOptions);
  }

  // 그룹 정보 조회 (그룹 ID가 있는 사진만)
  const groupIds = [...new Set(records.items.map(item => item.group as string).filter(Boolean))];
  const groupMap: Record<string, string> = {};

  if (groupIds.length > 0) {
    try {
      const groupFilter = groupIds.map(id => `id = "${id}"`).join(' || ');
      const groups = await client.collection('photo_groups').getList(1, groupIds.length, { filter: groupFilter });
      groups.items.forEach(g => { groupMap[g.id] = g.title as string; });
    } catch {
      // 그룹 조회 실패 시 무시
    }
  }

  return records.items.map(item => {
    const imageUrl = item.image
      ? client.files.getURL(item, item.image as string)
      : null;
    const thumbnailUrl = item.thumbnail
      ? client.files.getURL(item, item.thumbnail as string)
      : imageUrl; // fallback to original image

    return {
      id: item.id,
      title: (item.title as string) || '',
      groupId: (item.group as string) || null,
      groupTitle: groupMap[item.group as string] || null,
      imageUrl,
      thumbnailUrl,
      created: item.created,
    };
  });
}

export async function fetchPhotosByGroup(groupId: string, options: { limit?: number } = {}): Promise<Photo[]> {
  return fetchPhotos({ ...options, groupId });
}

export async function getPhotoCount(): Promise<number> {
  const client = getPocketBase();

  try {
    const result = await client.collection(COLLECTION).getList(1, 1);
    return result.totalItems;
  } catch {
    await authenticate();
    try {
      const result = await client.collection(COLLECTION).getList(1, 1);
      return result.totalItems;
    } catch {
      return 0;
    }
  }
}

export async function getGroupCount(): Promise<number> {
  const client = getPocketBase();

  try {
    const result = await client.collection('photo_groups').getList(1, 1);
    return result.totalItems;
  } catch {
    await authenticate();
    try {
      const result = await client.collection('photo_groups').getList(1, 1);
      return result.totalItems;
    } catch {
      return 0;
    }
  }
}
