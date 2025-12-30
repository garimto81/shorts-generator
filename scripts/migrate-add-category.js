#!/usr/bin/env node

/**
 * PocketBase photos 컬렉션에 AI 분류 필드 추가
 *
 * 실행: node scripts/migrate-add-category.js
 *
 * 추가되는 필드:
 * - aiCategory: text (카테고리)
 * - aiFeatures: json (특징 배열)
 * - aiMainSubject: text (주요 피사체)
 * - aiCategoryConfidence: number (신뢰도)
 * - aiCategorySource: text (분류 출처)
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// config.json 로드
const config = JSON.parse(readFileSync(join(__dirname, '../config.json'), 'utf-8'));

const API_URL = process.env.POCKETBASE_URL || config.pocketbase.url;
const AUTH_EMAIL = process.env.POCKETBASE_EMAIL || config.pocketbase.auth?.email;
const AUTH_PASSWORD = process.env.POCKETBASE_PASSWORD || config.pocketbase.auth?.password;
const COLLECTION = config.pocketbase.collection || 'photos';

const pb = new PocketBase(API_URL);

/**
 * 새로 추가할 필드 정의
 */
const NEW_FIELDS = [
  {
    name: 'aiCategory',
    type: 'text',
    required: false,
    options: {}
  },
  {
    name: 'aiFeatures',
    type: 'json',
    required: false,
    options: {}
  },
  {
    name: 'aiMainSubject',
    type: 'text',
    required: false,
    options: {}
  },
  {
    name: 'aiCategoryConfidence',
    type: 'number',
    required: false,
    options: {
      min: 0,
      max: 1
    }
  },
  {
    name: 'aiCategorySource',
    type: 'text',
    required: false,
    options: {}
  }
];

async function authenticate() {
  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error(
      'Admin 인증 정보가 필요합니다.\n' +
      '환경변수 설정: POCKETBASE_EMAIL, POCKETBASE_PASSWORD\n' +
      '또는 config.json의 pocketbase.auth 설정'
    );
  }

  try {
    await pb.collection('_superusers').authWithPassword(AUTH_EMAIL, AUTH_PASSWORD);
    console.log('✓ PocketBase Admin 로그인 성공');
  } catch (error) {
    throw new Error(`Admin 로그인 실패: ${error.message}`);
  }
}

async function getCollectionSchema() {
  try {
    const collection = await pb.collections.getOne(COLLECTION);
    return collection;
  } catch (error) {
    throw new Error(`컬렉션 조회 실패: ${error.message}`);
  }
}

async function updateCollectionSchema(collection, newFields) {
  const existingFieldNames = collection.schema.map(f => f.name);

  // 이미 존재하는 필드 제외
  const fieldsToAdd = newFields.filter(f => !existingFieldNames.includes(f.name));

  if (fieldsToAdd.length === 0) {
    console.log('✓ 모든 필드가 이미 존재합니다.');
    return;
  }

  console.log(`\n추가할 필드: ${fieldsToAdd.map(f => f.name).join(', ')}`);

  // 새 스키마 생성
  const updatedSchema = [...collection.schema, ...fieldsToAdd];

  try {
    await pb.collections.update(COLLECTION, {
      schema: updatedSchema
    });
    console.log('✓ 스키마 업데이트 완료');
  } catch (error) {
    throw new Error(`스키마 업데이트 실패: ${error.message}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('PocketBase AI 분류 필드 마이그레이션');
  console.log('========================================\n');

  console.log(`서버: ${API_URL}`);
  console.log(`컬렉션: ${COLLECTION}\n`);

  try {
    // 1. Admin 인증
    await authenticate();

    // 2. 현재 스키마 조회
    console.log('\n현재 스키마 조회 중...');
    const collection = await getCollectionSchema();
    console.log(`✓ 기존 필드: ${collection.schema.map(f => f.name).join(', ')}`);

    // 3. 스키마 업데이트
    console.log('\n스키마 업데이트 중...');
    await updateCollectionSchema(collection, NEW_FIELDS);

    console.log('\n========================================');
    console.log('✅ 마이그레이션 완료');
    console.log('========================================\n');

    console.log('추가된 필드:');
    NEW_FIELDS.forEach(f => {
      console.log(`  - ${f.name}: ${f.type}`);
    });

  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error.message);
    process.exit(1);
  }
}

main();
