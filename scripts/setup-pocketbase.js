#!/usr/bin/env node
/**
 * PocketBase 초기 설정 스크립트
 * - photos 컬렉션 생성
 * - API 규칙 설정
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../config.json'), 'utf-8'));

const pb = new PocketBase(config.pocketbase.url);

async function setup() {
  console.log('🚀 PocketBase 설정 시작...');
  console.log(`📡 서버: ${config.pocketbase.url}`);

  // 1. Superuser 로그인
  console.log('\n1️⃣ Superuser 로그인...');
  try {
    await pb.collection('_superusers').authWithPassword(
      config.pocketbase.auth.email,
      config.pocketbase.auth.password
    );
    console.log('✅ 로그인 성공');
  } catch (err) {
    console.error('❌ 로그인 실패:', err.message);
    console.log('\n💡 PocketHost 대시보드에서 Superuser를 먼저 생성하세요:');
    console.log(`   ${config.pocketbase.url}/_/`);
    console.log(`   Email: ${config.pocketbase.auth.email}`);
    console.log(`   Password: ${config.pocketbase.auth.password}`);
    process.exit(1);
  }

  // 2. photo_groups 컬렉션 확인/생성
  console.log('\n2️⃣ photo_groups 컬렉션 확인...');
  let photoGroupsId = null;
  try {
    const existing = await pb.collections.getOne('photo_groups');
    console.log('✅ photo_groups 컬렉션 이미 존재');
    photoGroupsId = existing.id;
  } catch (err) {
    if (err.status === 404) {
      console.log('📦 photo_groups 컬렉션 생성 중...');

      const created = await pb.collections.create({
        name: 'photo_groups',
        type: 'base',
        schema: [
          {
            name: 'title',
            type: 'text',
            required: true,
            options: { min: 1, max: 200 }
          }
        ],
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: ''
      });

      photoGroupsId = created.id;
      console.log('✅ photo_groups 컬렉션 생성 완료');
    } else {
      throw err;
    }
  }

  // 3. photos 컬렉션 확인/생성
  console.log('\n3️⃣ photos 컬렉션 확인...');
  try {
    const existing = await pb.collections.getOne('photos');
    console.log('✅ photos 컬렉션 이미 존재');
  } catch (err) {
    if (err.status === 404) {
      console.log('📦 photos 컬렉션 생성 중...');

      await pb.collections.create({
        name: 'photos',
        type: 'base',
        schema: [
          {
            name: 'title',
            type: 'text',
            required: true,
            options: { min: 1, max: 200 }
          },
          {
            name: 'image',
            type: 'file',
            required: true,
            options: {
              maxSelect: 1,
              maxSize: 10485760,
              mimeTypes: ['image/jpeg', 'image/png', 'image/webp']
            }
          },
          {
            name: 'thumbnail',
            type: 'file',
            required: false,
            options: {
              maxSelect: 1,
              maxSize: 1048576,
              mimeTypes: ['image/jpeg', 'image/png', 'image/webp']
            }
          },
          {
            name: 'group',
            type: 'relation',
            required: false,
            options: {
              collectionId: photoGroupsId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['title']
            }
          }
        ],
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: ''
      });

      console.log('✅ photos 컬렉션 생성 완료');
    } else {
      throw err;
    }
  }

  // 4. 컬렉션 정보 출력
  console.log('\n4️⃣ 컬렉션 정보 확인...');
  const collections = await pb.collections.getFullList();
  console.log(`📋 총 ${collections.length}개 컬렉션:`);
  collections.forEach(c => {
    if (!c.name.startsWith('_')) {
      console.log(`   - ${c.name} (${c.type})`);
    }
  });

  console.log('\n✨ PocketBase 설정 완료!');
  console.log(`\n📸 사진 업로드: ${config.pocketbase.url}/_/#/collections?collectionId=photos`);
}

setup().catch(err => {
  console.error('❌ 설정 실패:', err);
  process.exit(1);
});
