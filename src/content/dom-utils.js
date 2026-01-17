/**
 * TruthSeek DOM Utilities
 * Shared helpers for content UI rendering
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Sanitize URLs for safe href usage
 * @param {string} url - URL to sanitize
 * @returns {string} Safe URL
 */
export function sanitizeUrl(url) {
  if (!url) {
    return '#';
  }
  
  try {
    const parsed = new URL(url, window.location.href);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') {
      return parsed.href;
    }
  } catch (error) {
    // Fall through to safe fallback
  }
  
  return '#';
}

/**
 * Clamp a value to 0-100 as a rounded percentage
 * @param {number} value - Percentage value
 * @returns {number} Clamped percentage
 */
export function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(number)));
}
