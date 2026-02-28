/**
 * @param {string} keywords
 * @returns {string} Normalized text without Vietnamese accents
 */
export function normalizeSearchText(keywords) {
  return keywords
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
