/**
 * Google Gemini Vision API 클라이언트
 *
 * 이미지를 분석하여 마케팅용 자막을 생성합니다.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPrompt } from './prompt-templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// config.json 로드
let configCache = null;
function getConfig() {
  if (!configCache) {
    try {
      configCache = JSON.parse(readFileSync(join(__dirname, '../../config.json'), 'utf-8'));
    } catch {
      configCache = {};
    }
  }
  return configCache;
}

// API 키: 환경변수 우선, config.json 폴백
function getApiKey() {
  if (process.env.GOOGLE_API_KEY) {
    return process.env.GOOGLE_API_KEY;
  }
  return getConfig().ai?.apiKey || null;
}

// 기본 모델명: config.json에서 가져오기
function getDefaultModel() {
  return getConfig().ai?.model || 'gemini-2.0-flash-exp';
}

const API_KEY = getApiKey();

/**
 * Gemini 모델 인스턴스 가져오기
 * @param {string} modelName - 모델 이름
 * @returns {GenerativeModel}
 */
function getModel(modelName) {
  const model = modelName || getDefaultModel();
  if (!API_KEY) {
    throw new Error(
      'GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.\n' +
      '설정 방법: set GOOGLE_API_KEY=your-api-key (Windows)\n' +
      'API 키 발급: https://aistudio.google.com/apikey'
    );
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  return genAI.getGenerativeModel({ model });
}

/**
 * 이미지 파일을 base64로 인코딩
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {Promise<{data: string, mimeType: string}>}
 */
async function imageToBase64(imagePath) {
  const imageData = await fs.readFile(imagePath);
  const base64 = imageData.toString('base64');

  // MIME 타입 추론
  const ext = imagePath.toLowerCase().split('.').pop();
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp'
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  return { data: base64, mimeType };
}

/**
 * 단일 이미지 분석하여 자막 생성
 * @param {string} imagePath - 이미지 파일 경로
 * @param {Object} options - 옵션
 * @param {string} options.promptTemplate - 프롬프트 템플릿 타입
 * @param {string} options.quality - 품질 레벨 (creative|balanced|conservative)
 * @param {string} options.model - Gemini 모델 이름
 * @returns {Promise<string>} 생성된 자막
 */
export async function analyzeImage(imagePath, options = {}) {
  const {
    promptTemplate = 'default',
    quality = 'balanced',
    model: modelName
  } = options;

  const model = getModel(modelName);
  const { data, mimeType } = await imageToBase64(imagePath);
  const prompt = getPrompt(promptTemplate, quality);

  const result = await model.generateContent([
    { inlineData: { mimeType, data } },
    prompt
  ]);

  const response = result.response;
  const text = response.text().trim();

  // 따옴표 제거 (AI가 때때로 따옴표로 감싸서 응답)
  return text.replace(/^["']|["']$/g, '');
}

/**
 * 여러 이미지를 배치로 분석
 * @param {Array<{id: string, localPath: string}>} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {string} options.promptTemplate - 프롬프트 템플릿 타입
 * @param {string} options.quality - 품질 레벨 (creative|balanced|conservative)
 * @param {string} options.model - Gemini 모델 이름
 * @param {number} options.delayMs - 요청 간 지연 시간 (ms)
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, string>>} ID별 자막 맵
 */
export async function analyzeImageBatch(photos, options = {}) {
  const {
    promptTemplate = 'default',
    quality = 'balanced',
    model,
    delayMs = 1000, // rate limit 방지
    onProgress
  } = options;

  const results = new Map();
  const total = photos.length;

  for (let i = 0; i < total; i++) {
    const photo = photos[i];

    try {
      if (onProgress) {
        onProgress({ current: i + 1, total, photoId: photo.id, status: 'analyzing' });
      }

      const subtitle = await analyzeImage(photo.localPath, {
        promptTemplate,
        quality,
        model
      });

      results.set(photo.id, subtitle);

      if (onProgress) {
        onProgress({ current: i + 1, total, photoId: photo.id, status: 'done', subtitle });
      }

      // rate limit 방지를 위한 지연
      if (i < total - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.warn(`AI 분석 실패 (${photo.id}): ${error.message}`);
      results.set(photo.id, null); // 실패 시 null

      if (onProgress) {
        onProgress({ current: i + 1, total, photoId: photo.id, status: 'error', error: error.message });
      }
    }
  }

  return results;
}

/**
 * API 키 유효성 확인
 * @returns {boolean}
 */
export function isApiKeySet() {
  return !!API_KEY;
}
