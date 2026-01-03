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
  },

  // 최고 품질 - 렌더링 시간보다 품질 우선
  ultraQuality: {
    name: '울트라 퀄리티',
    description: '최고 품질 설정 (렌더링 시간 증가)',
    photoDuration: 4,
    transition: 'fade',
    transitionDuration: 1.2,
    kenBurns: true,
    zoomIntensity: 0.1,              // 부드러운 움직임
    kenBurnsMode: 'sequential',
    subtitlePosition: 'bottom',
    subtitleStyle: 'boxedShadow',    // 가장 가독성 높은 스타일
    // Ultra Quality 전용 인코딩 설정 (generator.js에서 사용)
    encoding: {
      preset: 'veryslow',            // 최고 압축 효율
      crf: 16,                       // 최고 품질
      bitrate: '12M',                // 높은 비트레이트
      maxrate: '15M',
      bufsize: '24M'
    }
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
 * - top: 상단 15% (h*0.15) - UI 버튼 영역 피함
 * - center: 중앙 - 가장 안전한 위치
 * - bottom: 화면 60% 지점 (h*0.6) - 하단 672px 여백 확보
 *
 * 참고: YouTube Shorts Safe Zone
 * - 하단 672px (35%) 여백 권장
 * - 자막은 화면 중앙 70% 영역에 배치
 */
export const SUBTITLE_POSITIONS = {
  top: 'h*0.15',           // 상단 15% (288px)
  center: '(h-text_h)/2',  // 정중앙
  bottom: 'h*0.6'          // 화면 60% 지점 (1152px) - 하단 768px 여백
};

/**
 * Subtitle style configurations
 */
export const SUBTITLE_STYLES = {
  // 기본 스타일 - 강화된 가독성
  default: {
    fontSize: 72,              // 60 → 72 (더 큰 폰트)
    borderWidth: 5,            // 4 → 5 (더 두꺼운 테두리)
    backgroundColor: null,
    shadow: true,
    shadowX: 4,                // 2 → 4 (더 강한 그림자)
    shadowY: 4,
    shadowColor: '0x000000AA'  // 67% 투명도 (더 진하게)
  },
  // 강조 스타일 - 임팩트 있는 자막
  bold: {
    fontSize: 80,              // 70 → 80
    borderWidth: 6,            // 4 → 6
    backgroundColor: null,
    shadow: true,              // false → true
    shadowX: 5,
    shadowY: 5,
    shadowColor: '0x000000CC'
  },
  // 미니멀 스타일 - 깔끔한 느낌
  minimal: {
    fontSize: 56,              // 50 → 56
    borderWidth: 3,            // 2 → 3
    backgroundColor: null,
    shadow: true,              // false → true
    shadowX: 2,
    shadowY: 2,
    shadowColor: '0x00000066'
  },
  // 우아한 스타일 - 세련된 느낌
  elegant: {
    fontSize: 64,              // 55 → 64
    borderWidth: 3,            // 2 → 3
    backgroundColor: null,
    shadow: true,              // false → true
    shadowX: 3,
    shadowY: 3,
    shadowColor: '0x00000088'
  },
  // 시네마틱 스타일 - 영화같은 분위기
  cinematic: {
    fontSize: 68,              // 65 → 68
    borderWidth: 4,            // 3 → 4
    backgroundColor: null,
    shadow: true,
    shadowX: 5,                // 3 → 5
    shadowY: 5,
    shadowColor: '0x000000BB'
  },
  // 고대비 스타일 - 강한 대비
  contrast: {
    fontSize: 72,              // 65 → 72
    borderWidth: 6,            // 4 → 6
    backgroundColor: null,
    shadow: true,              // false → true
    shadowX: 4,
    shadowY: 4,
    shadowColor: '0x000000CC'
  },
  // 박스 스타일 - 반투명 배경
  boxed: {
    fontSize: 68,              // 60 → 68
    borderWidth: 3,            // 2 → 3
    backgroundColor: '0x000000BB',  // 73% 투명도 (더 진하게)
    backgroundPadding: 18,     // 15 → 18
    shadow: true,              // false → true
    shadowX: 3,
    shadowY: 3,
    shadowColor: '0x00000066'
  },
  // 그림자 강조 스타일
  shadow: {
    fontSize: 68,              // 60 → 68
    borderWidth: 4,            // 2 → 4
    backgroundColor: null,
    shadow: true,
    shadowX: 6,                // 4 → 6
    shadowY: 6,
    shadowColor: '0x000000BB'  // 더 진한 그림자
  },
  // 최고 가독성 스타일 - 박스 + 그림자 조합
  boxedShadow: {
    fontSize: 68,              // 60 → 68
    borderWidth: 3,            // 2 → 3
    backgroundColor: '0x000000AA',  // 67% 투명도
    backgroundPadding: 16,     // 12 → 16
    shadow: true,
    shadowX: 4,                // 2 → 4
    shadowY: 4,
    shadowColor: '0x00000088'
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
