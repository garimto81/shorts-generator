export const SUBTITLE_STYLE = {
  fontSize: 60,
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 2,
  position: { y: 0.85 }
};

export function formatSubtitle(text, maxLength = 15) {
  if (text.length <= maxLength) return text;

  const lines = [];
  let current = '';

  for (const char of text) {
    if (current.length >= maxLength) {
      lines.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) lines.push(current);

  return lines.join('\n');
}
