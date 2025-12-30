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
import {
  getPrompt,
  getPromptWithExamples,
  FEATURE_EXTRACTION_PROMPT,
  BATCH_FEATURE_EXTRACTION_PROMPT,
  getFeatureBasedSubtitlePrompt
} from './prompt-templates.js';

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
 * AI 응답에서 마크다운 및 불필요한 형식 제거
 * @param {string} text - AI 응답 텍스트
 * @returns {string} 정제된 텍스트
 */
function cleanSubtitle(text) {
  if (!text) return text;

  // 1. 여러 선택지가 있는 경우 첫 번째 따옴표 안의 내용만 추출
  // 패턴: **선택 1:** "첫 번째" **선택 2:** "두 번째"
  const quotedMatches = text.match(/"([^"]+)"/g);
  if (quotedMatches && quotedMatches.length >= 1) {
    // 첫 번째 따옴표 안의 내용 사용
    text = quotedMatches[0].replace(/^"|"$/g, '');
  }

  let cleaned = text
    // 마크다운 헤딩 제거: ## 제목 → 제목
    .replace(/^#{1,6}\s*/gm, '')
    // 마크다운 볼드 제거: **text** → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 마크다운 이탤릭 제거: *text* → text
    .replace(/\*([^*]+)\*/g, '$1')
    // 선택지 형식 제거: 선택 1:, 선택 2: 등
    .replace(/선택\s*\d+[:\s]*/gi, '')
    // 번호 목록 제거: 1. 2. 3.
    .replace(/^\d+\.\s*/gm, '')
    // 라벨 형식 제거: "휠 복원 마케팅 자막:" 등
    .replace(/^[가-힣\s]+자막[:\s]*/gi, '')
    // 앞뒤 따옴표 제거
    .replace(/^["'「」『』]+|["'「」『』]+$/g, '')
    // 줄바꿈을 공백으로 변환 (다중 줄 응답 처리)
    .replace(/\n+/g, ' ')
    // 다중 공백을 단일 공백으로
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

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
 * @param {string} options.customExamplesPath - 커스텀 예시 파일 경로 (v2.0)
 * @param {boolean} options.useFewShot - Few-Shot 예시 사용 여부 (기본 true)
 * @returns {Promise<string>} 생성된 자막
 */
export async function analyzeImage(imagePath, options = {}) {
  const {
    promptTemplate = 'default',
    quality = 'balanced',
    model: modelName,
    customExamplesPath = null,
    useFewShot = true
  } = options;

  const model = getModel(modelName);
  const { data, mimeType } = await imageToBase64(imagePath);

  // v2.0: Few-Shot 예시 사용 여부에 따라 프롬프트 선택
  const prompt = useFewShot
    ? getPromptWithExamples(promptTemplate, quality, { customExamplesPath })
    : getPrompt(promptTemplate, quality);

  const result = await model.generateContent([
    { inlineData: { mimeType, data } },
    prompt
  ]);

  const response = result.response;
  const text = response.text().trim();

  // 마크다운 및 불필요한 형식 제거
  return cleanSubtitle(text);
}

/**
 * 여러 이미지를 배치로 분석
 * @param {Array<{id: string, localPath: string}>} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {string} options.promptTemplate - 프롬프트 템플릿 타입
 * @param {string} options.quality - 품질 레벨 (creative|balanced|conservative)
 * @param {string} options.model - Gemini 모델 이름
 * @param {string} options.customExamplesPath - 커스텀 예시 파일 경로 (v2.0)
 * @param {boolean} options.useFewShot - Few-Shot 예시 사용 여부 (기본 true)
 * @param {number} options.delayMs - 요청 간 지연 시간 (ms)
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, string>>} ID별 자막 맵
 */
export async function analyzeImageBatch(photos, options = {}) {
  const {
    promptTemplate = 'default',
    quality = 'balanced',
    model,
    customExamplesPath = null,
    useFewShot = true,
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
        model,
        customExamplesPath,
        useFewShot
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

// ============================================================
// v3.0: 이미지 특징 추출 기능 (2단계 분석 시스템)
// ============================================================

/**
 * AI 응답에서 JSON 파싱
 * @param {string} text - AI 응답 텍스트
 * @returns {Object|Array|null} 파싱된 JSON 또는 null
 */
function parseJSONResponse(text) {
  if (!text) return null;

  // JSON 블록 추출 시도
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                   text.match(/```\s*([\s\S]*?)\s*```/) ||
                   text.match(/(\[[\s\S]*\])/) ||
                   text.match(/(\{[\s\S]*\})/);

  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    // 재시도: 줄바꿈 및 특수문자 정리
    try {
      const cleaned = jsonStr
        .replace(/[\r\n]+/g, ' ')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

/**
 * 단일 이미지 특징 추출
 * @param {string} imagePath - 이미지 파일 경로
 * @param {Object} options - 옵션
 * @param {string} options.model - Gemini 모델 이름
 * @returns {Promise<Object>} 특징 추출 결과
 */
export async function extractImageFeatures(imagePath, options = {}) {
  const { model: modelName } = options;

  const model = getModel(modelName);
  const { data, mimeType } = await imageToBase64(imagePath);

  const result = await model.generateContent([
    { inlineData: { mimeType, data } },
    FEATURE_EXTRACTION_PROMPT
  ]);

  const response = result.response;
  const text = response.text().trim();

  const parsed = parseJSONResponse(text);

  if (!parsed) {
    throw new Error('JSON 파싱 실패');
  }

  return {
    category: parsed.category || 'default',
    mainSubject: parsed.mainSubject || '',
    features: parsed.features || [],
    confidence: parsed.confidence || 0.5,
    reason: parsed.reason || ''
  };
}

/**
 * 배치 이미지 특징 추출 (여러 이미지 한 번에)
 * @param {Array<{id: string, localPath: string}>} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {string} options.model - Gemini 모델 이름
 * @param {number} options.delayMs - 요청 간 지연 시간 (ms)
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, Object>>} ID별 특징 추출 결과 맵
 */
export async function extractFeaturesBatch(photos, options = {}) {
  const {
    model: modelName,
    delayMs = 1000,
    onProgress
  } = options;

  const results = new Map();
  const total = photos.length;

  // 개별 처리 (배치 API 미지원 시)
  for (let i = 0; i < total; i++) {
    const photo = photos[i];

    try {
      if (onProgress) {
        onProgress({ current: i + 1, total, photoId: photo.id, status: 'extracting' });
      }

      const features = await extractImageFeatures(photo.localPath, { model: modelName });
      results.set(photo.id, features);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          photoId: photo.id,
          status: 'done',
          category: features.category,
          features: features.features
        });
      }

      // rate limit 방지
      if (i < total - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.warn(`특징 추출 실패 (${photo.id}): ${error.message}`);
      results.set(photo.id, null);

      if (onProgress) {
        onProgress({ current: i + 1, total, photoId: photo.id, status: 'error', error: error.message });
      }
    }
  }

  return results;
}

/**
 * 특징 기반 맞춤 자막 생성
 * @param {string} imagePath - 이미지 파일 경로
 * @param {Object} analysis - 특징 추출 결과
 * @param {Object} options - 옵션
 * @param {string} options.model - Gemini 모델 이름
 * @returns {Promise<string>} 생성된 자막
 */
export async function generateSubtitleFromFeatures(imagePath, analysis, options = {}) {
  const { model: modelName } = options;

  const model = getModel(modelName);
  const { data, mimeType } = await imageToBase64(imagePath);

  // 특징 기반 맞춤 프롬프트 생성
  const prompt = getFeatureBasedSubtitlePrompt(analysis);

  const result = await model.generateContent([
    { inlineData: { mimeType, data } },
    prompt
  ]);

  const response = result.response;
  const text = response.text().trim();

  return cleanSubtitle(text);
}

/**
 * 2단계 분석: 특징 추출 → 맞춤 자막 생성
 * @param {string} imagePath - 이미지 파일 경로
 * @param {Object} options - 옵션
 * @param {string} options.model - Gemini 모델 이름
 * @param {Object} options.preExtractedFeatures - 이미 추출된 특징 (있으면 재사용)
 * @returns {Promise<{subtitle: string, analysis: Object}>} 자막과 분석 결과
 */
export async function analyzeImageTwoStep(imagePath, options = {}) {
  const { model: modelName, preExtractedFeatures } = options;

  // 1단계: 특징 추출 (이미 있으면 재사용)
  let analysis = preExtractedFeatures;
  if (!analysis) {
    analysis = await extractImageFeatures(imagePath, { model: modelName });
  }

  // 2단계: 특징 기반 자막 생성
  const subtitle = await generateSubtitleFromFeatures(imagePath, analysis, { model: modelName });

  return {
    subtitle,
    analysis
  };
}

/**
 * 배치 2단계 분석
 * @param {Array<{id: string, localPath: string}>} photos - 사진 배열
 * @param {Object} options - 옵션
 * @param {Map<string, Object>} options.preExtractedFeatures - 이미 추출된 특징 맵
 * @param {string} options.model - Gemini 모델 이름
 * @param {number} options.delayMs - 요청 간 지연 시간 (ms)
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Promise<Map<string, {subtitle: string, analysis: Object}>>} ID별 결과 맵
 */
export async function analyzeImageBatchTwoStep(photos, options = {}) {
  const {
    preExtractedFeatures = new Map(),
    model: modelName,
    delayMs = 1000,
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

      const preFeatures = preExtractedFeatures.get(photo.id);
      const result = await analyzeImageTwoStep(photo.localPath, {
        model: modelName,
        preExtractedFeatures: preFeatures
      });

      results.set(photo.id, result);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          photoId: photo.id,
          status: 'done',
          subtitle: result.subtitle,
          category: result.analysis.category
        });
      }

      // rate limit 방지
      if (i < total - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.warn(`2단계 분석 실패 (${photo.id}): ${error.message}`);
      results.set(photo.id, { subtitle: null, analysis: null });

      if (onProgress) {
        onProgress({ current: i + 1, total, photoId: photo.id, status: 'error', error: error.message });
      }
    }
  }

  return results;
}
