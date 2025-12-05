export const TEMPLATES = {
  wheelRestoration: {
    name: '휠 복원',
    photoDuration: 3,
    transition: 'directionalwipe',
    subtitlePosition: 'bottom'
  },
  beforeAfter: {
    name: '전/후 비교',
    photoDuration: 4,
    transition: 'crossfade',
    subtitlePosition: 'center'
  },
  slideshow: {
    name: '슬라이드쇼',
    photoDuration: 2,
    transition: 'fade',
    subtitlePosition: 'bottom'
  }
};

export function getTemplate(name) {
  return TEMPLATES[name] || TEMPLATES.slideshow;
}
