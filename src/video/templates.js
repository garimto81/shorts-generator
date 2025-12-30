/**
 * Video Templates for Shorts Generator
 * Each template defines a complete set of video generation options
 */

export const TEMPLATES = {
  // 기본 템플릿 - 균형 잡힌 설정
  classic: {
    name: '클래식',
    description: '기본 슬라이드쇼 (균형 잡힌 설정)',
    photoDuration: 3,
    transition: 'fade',
    transitionDuration: 0.5,
    kenBurns: true,
    zoomIntensity: 0.15,
    kenBurnsMode: 'classic',  // 기존 zoom in/out 교차
    subtitlePosition: 'bottom',
    subtitleStyle: 'default'
  },

  // 빠른 전환 - 역동적인 영상
  dynamic: {
    name: '다이나믹',
    description: '빠른 전환과 강한 줌 효과 + 다양한 움직임',
    photoDuration: 2,
    transition: 'slideright',
    transitionDuration: 0.3,
    kenBurns: true,
    zoomIntensity: 0.2,
    kenBurnsMode: 'sequential',  // 8가지 패턴 순환
    subtitlePosition: 'bottom',
    subtitleStyle: 'bold'
  },

  // 부드러운 전환 - 고급스러운 느낌
  elegant: {
    name: '엘레강스',
    description: '느린 전환과 부드러운 줌',
    photoDuration: 4,
    transition: 'crossfade',
    transitionDuration: 1.0,
    kenBurns: true,
    zoomIntensity: 0.1,
    kenBurnsMode: 'classic',
    subtitlePosition: 'bottom',
    subtitleStyle: 'elegant'
  },

  // 미니멀 - 효과 최소화
  minimal: {
    name: '미니멀',
    description: '효과 최소화, 깔끔한 전환',
    photoDuration: 3,
    transition: 'fade',
    transitionDuration: 0.5,
    kenBurns: false,
    zoomIntensity: 0,
    subtitlePosition: 'bottom',
    subtitleStyle: 'minimal'
  },

  // 휠 복원 전문
  wheelRestoration: {
    name: '휠 복원',
    description: '휠 복원 작업에 최적화 (다양한 앵글)',
    photoDuration: 3,
    transition: 'directionalwipe',
    transitionDuration: 0.5,
    kenBurns: true,
    zoomIntensity: 0.15,
    kenBurnsMode: 'sequential',  // 다양한 패턴으로 디테일 강조
    subtitlePosition: 'bottom',
    subtitleStyle: 'default'
  },

  // 전/후 비교
  beforeAfter: {
    name: '전후 비교',
    description: '전/후 비교에 적합한 설정',
    photoDuration: 4,
    transition: 'wipeleft',
    transitionDuration: 0.8,
    kenBurns: true,
    zoomIntensity: 0.12,
    kenBurnsMode: 'classic',  // 심플하게 zoom in/out
    subtitlePosition: 'center',
    subtitleStyle: 'contrast'
  },

  // 빠른 모드 - 짧은 영상
  quick: {
    name: '퀵',
    description: '짧고 빠른 영상 (TikTok 최적화)',
    photoDuration: 1.5,
    transition: 'slideleft',
    transitionDuration: 0.2,
    kenBurns: true,
    zoomIntensity: 0.18,
    kenBurnsMode: 'random',  // 무작위로 역동적
    subtitlePosition: 'bottom',
    subtitleStyle: 'bold'
  },

  // 시네마틱 - 영화같은 느낌
  cinematic: {
    name: '시네마틱',
    description: '영화같은 분위기 (부드러운 패닝)',
    photoDuration: 5,
    transition: 'fade',
    transitionDuration: 1.5,
    kenBurns: true,
    zoomIntensity: 0.08,
    kenBurnsMode: 'sequential',  // 천천히 순환하며 시네마틱 효과
    subtitlePosition: 'bottom',
    subtitleStyle: 'cinematic'
  }
};

/**
 * Get template by name
 * @param {string} name - Template name
 * @returns {Object} Template configuration
 */
export function getTemplate(name) {
  return TEMPLATES[name] || TEMPLATES.classic;
}

/**
 * Get all template names
 * @returns {string[]} Array of template names
 */
export function getTemplateNames() {
  return Object.keys(TEMPLATES);
}

/**
 * Get template list with descriptions
 * @returns {Array} Array of {name, displayName, description}
 */
export function getTemplateList() {
  return Object.entries(TEMPLATES).map(([key, template]) => ({
    name: key,
    displayName: template.name,
    description: template.description
  }));
}

/**
 * Apply template to config
 * Merges template settings with existing config, template takes precedence
 * @param {Object} config - Base config object
 * @param {string} templateName - Template name to apply
 * @returns {Object} Merged config
 */
export function applyTemplate(config, templateName) {
  const template = getTemplate(templateName);

  return {
    ...config,
    video: {
      ...config.video,
      photoDuration: template.photoDuration,
      transition: template.transition,
      transitionDuration: template.transitionDuration
    },
    template: {
      name: templateName,
      kenBurns: template.kenBurns,
      zoomIntensity: template.zoomIntensity,
      kenBurnsMode: template.kenBurnsMode || 'sequential',
      subtitlePosition: template.subtitlePosition,
      subtitleStyle: template.subtitleStyle
    }
  };
}

/**
 * Subtitle position configurations
 *
 * Safe Zone 적용 (TikTok/Reels/Shorts 호환):
 * - top: 상단 240px (h/8) - UI 버튼 영역 피함
 * - center: 중앙 - 가장 안전한 위치
 * - bottom: 하단 320px 여백 (h-h/6) - 하단 UI 영역 피함
 */
export const SUBTITLE_POSITIONS = {
  top: 'h/8',              // 240px (이전: 192px)
  center: '(h-text_h)/2',
  bottom: 'h-h/6'          // 1600px (이전: 1728px) - 320px 하단 여백
};

/**
 * Subtitle style configurations
 */
export const SUBTITLE_STYLES = {
  default: {
    fontSize: 60,
    borderWidth: 3,
    backgroundColor: null,
    shadow: false
  },
  bold: {
    fontSize: 70,
    borderWidth: 4,
    backgroundColor: null,
    shadow: false
  },
  minimal: {
    fontSize: 50,
    borderWidth: 2,
    backgroundColor: null,
    shadow: false
  },
  elegant: {
    fontSize: 55,
    borderWidth: 2,
    backgroundColor: null,
    shadow: false
  },
  cinematic: {
    fontSize: 65,
    borderWidth: 3,
    backgroundColor: null,
    shadow: true,
    shadowX: 3,
    shadowY: 3
  },
  contrast: {
    fontSize: 65,
    borderWidth: 4,
    backgroundColor: null,
    shadow: false
  },
  // 새 스타일: 반투명 배경 박스
  boxed: {
    fontSize: 60,
    borderWidth: 2,
    backgroundColor: '0x00000099',  // 검정 60% 투명도
    backgroundPadding: 15,
    shadow: false
  },
  // 새 스타일: 그림자 효과
  shadow: {
    fontSize: 60,
    borderWidth: 2,
    backgroundColor: null,
    shadow: true,
    shadowX: 4,
    shadowY: 4,
    shadowColor: '0x00000080'
  },
  // 새 스타일: 배경 + 그림자 조합
  boxedShadow: {
    fontSize: 60,
    borderWidth: 2,
    backgroundColor: '0x00000080',  // 검정 50% 투명도
    backgroundPadding: 12,
    shadow: true,
    shadowX: 2,
    shadowY: 2,
    shadowColor: '0x00000060'
  }
};

/**
 * Get subtitle style by name
 * @param {string} name - Style name
 * @returns {Object} Style configuration
 */
export function getSubtitleStyle(name) {
  return SUBTITLE_STYLES[name] || SUBTITLE_STYLES.default;
}

/**
 * Get all subtitle style names
 * @returns {string[]} Array of style names
 */
export function getSubtitleStyleNames() {
  return Object.keys(SUBTITLE_STYLES);
}
