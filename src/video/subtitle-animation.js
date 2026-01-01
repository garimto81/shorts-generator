/**
 * Subtitle Animation Module
 * FFmpeg drawtext 필터용 자막 애니메이션 효과
 */

/**
 * 자막 애니메이션 타입
 */
export const SUBTITLE_ANIMATIONS = {
  // 애니메이션 없음 (기본)
  none: 'none',
  // 페이드인 효과
  fadeIn: 'fadeIn',
  // 페이드인아웃 효과
  fadeInOut: 'fadeInOut',
  // 슬라이드업 효과
  slideUp: 'slideUp',
  // 타이핑 효과 (글자씩 나타남)
  typing: 'typing'
};

/**
 * 애니메이션 이름 목록
 */
export const SUBTITLE_ANIMATION_NAMES = Object.values(SUBTITLE_ANIMATIONS);

/**
 * 페이드인 알파 표현식 생성
 * @param {number} clipStartTime - 클립 시작 시간 (초)
 * @param {number} fadeDuration - 페이드 지속 시간 (초, 기본 0.3)
 * @returns {string} FFmpeg alpha 표현식
 */
export function getFadeInAlpha(clipStartTime, fadeDuration = 0.3) {
  // t는 전체 영상 기준 시간, clipStartTime부터 fadeDuration 동안 0→1
  return `if(lt(t-${clipStartTime},${fadeDuration}),(t-${clipStartTime})/${fadeDuration},1)`;
}

/**
 * 페이드인아웃 알파 표현식 생성
 * @param {number} clipStartTime - 클립 시작 시간 (초)
 * @param {number} clipDuration - 클립 지속 시간 (초)
 * @param {number} fadeDuration - 페이드 지속 시간 (초, 기본 0.3)
 * @returns {string} FFmpeg alpha 표현식
 */
export function getFadeInOutAlpha(clipStartTime, clipDuration, fadeDuration = 0.3) {
  const clipEndTime = clipStartTime + clipDuration;
  const fadeOutStart = clipEndTime - fadeDuration;

  // 시작 페이드인 + 끝 페이드아웃
  return `if(lt(t,${clipStartTime}),0,` +
         `if(lt(t,${clipStartTime + fadeDuration}),(t-${clipStartTime})/${fadeDuration},` +
         `if(lt(t,${fadeOutStart}),1,` +
         `if(lt(t,${clipEndTime}),(${clipEndTime}-t)/${fadeDuration},0))))`;
}

/**
 * 슬라이드업 Y 위치 표현식 생성
 * @param {number} baseY - 기본 Y 위치 (픽셀)
 * @param {number} clipStartTime - 클립 시작 시간 (초)
 * @param {number} slideDuration - 슬라이드 지속 시간 (초, 기본 0.3)
 * @param {number} slideDistance - 슬라이드 거리 (픽셀, 기본 50)
 * @returns {string} FFmpeg y 표현식
 */
export function getSlideUpY(baseY, clipStartTime, slideDuration = 0.3, slideDistance = 50) {
  // 아래에서 위로 슬라이드 (slideDistance에서 0으로)
  return `${baseY}+if(lt(t-${clipStartTime},${slideDuration}),` +
         `${slideDistance}*(1-(t-${clipStartTime})/${slideDuration}),0)`;
}

/**
 * 자막 애니메이션 파라미터 생성
 * @param {string} animationType - 애니메이션 타입 (SUBTITLE_ANIMATIONS 값)
 * @param {number} clipStartTime - 클립 시작 시간 (초)
 * @param {number} clipDuration - 클립 지속 시간 (초)
 * @param {Object} options - 추가 옵션
 * @param {number} options.fadeDuration - 페이드 지속 시간 (기본 0.3)
 * @param {number} options.baseY - 기본 Y 위치 (슬라이드업용)
 * @returns {Object} { alpha?: string, y?: string }
 */
export function getSubtitleAnimationParams(animationType, clipStartTime, clipDuration, options = {}) {
  const { fadeDuration = 0.3, baseY } = options;

  switch (animationType) {
    case SUBTITLE_ANIMATIONS.fadeIn:
      return {
        alpha: getFadeInAlpha(clipStartTime, fadeDuration)
      };

    case SUBTITLE_ANIMATIONS.fadeInOut:
      return {
        alpha: getFadeInOutAlpha(clipStartTime, clipDuration, fadeDuration)
      };

    case SUBTITLE_ANIMATIONS.slideUp:
      if (baseY === undefined) {
        throw new Error('slideUp animation requires baseY option');
      }
      return {
        alpha: getFadeInAlpha(clipStartTime, fadeDuration),
        y: getSlideUpY(baseY, clipStartTime, fadeDuration)
      };

    case SUBTITLE_ANIMATIONS.typing:
      // 타이핑 효과는 text 표현식 수정이 필요하므로 별도 처리
      // FFmpeg drawtext의 text_shaping 또는 substr 함수 사용 필요
      // 현재는 fadeIn으로 폴백
      return {
        alpha: getFadeInAlpha(clipStartTime, fadeDuration)
      };

    case SUBTITLE_ANIMATIONS.none:
    default:
      return {};
  }
}

/**
 * drawtext 필터에 애니메이션 파라미터 추가
 * @param {string} drawtextParams - 기존 drawtext 파라미터 문자열
 * @param {string} animationType - 애니메이션 타입
 * @param {number} clipStartTime - 클립 시작 시간
 * @param {number} clipDuration - 클립 지속 시간
 * @param {Object} options - 추가 옵션
 * @returns {string} 애니메이션이 적용된 drawtext 파라미터
 */
export function applySubtitleAnimation(drawtextParams, animationType, clipStartTime, clipDuration, options = {}) {
  if (animationType === SUBTITLE_ANIMATIONS.none) {
    return drawtextParams;
  }

  const animParams = getSubtitleAnimationParams(animationType, clipStartTime, clipDuration, options);

  let result = drawtextParams;

  if (animParams.alpha) {
    result += `:alpha='${animParams.alpha}'`;
  }

  // y 파라미터가 있으면 기존 y 값을 교체해야 함
  // 이 경우 호출자가 y 값을 직접 처리해야 함
  if (animParams.y) {
    // y 파라미터는 drawtextParams에 이미 포함되어 있을 수 있으므로
    // 호출자가 y 값을 animParams.y로 대체해야 함
    result += `:_animY='${animParams.y}'`;  // 마커로 추가 (후처리 필요)
  }

  return result;
}

export default {
  SUBTITLE_ANIMATIONS,
  SUBTITLE_ANIMATION_NAMES,
  getFadeInAlpha,
  getFadeInOutAlpha,
  getSlideUpY,
  getSubtitleAnimationParams,
  applySubtitleAnimation
};
