/**
 * TruthSeek JSON Sanitizer
 * Escapes control characters inside JSON string values
 */

/**
 * Sanitize JSON string by escaping control characters inside strings
 * @param {string} jsonText - Raw JSON text
 * @returns {string}
 */
export function sanitizeJsonString(jsonText) {
  if (typeof jsonText !== 'string' || jsonText.length === 0) {
    return jsonText;
  }
  
  let result = '';
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];
    const code = jsonText.charCodeAt(i);
    
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString && code < 0x20) {
      switch (char) {
        case '\n':
          result += '\\n';
          break;
        case '\r':
          result += '\\r';
          break;
        case '\t':
          result += '\\t';
          break;
        default:
          result += `\\u${code.toString(16).padStart(4, '0')}`;
          break;
      }
      continue;
    }
    
    result += char;
  }
  
  return result;
}

/**
 * Extract JSON object from mixed text
 * @param {string} text - Response text
 * @returns {object|null}
 */
export function extractJsonObject(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return null;
  }
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }
  
  try {
    const sanitized = sanitizeJsonString(jsonMatch[0]);
    return JSON.parse(sanitized);
  } catch (error) {
    return null;
  }
}

/**
 * Build a minimal verification result from free-form text
 * @param {string} text - Response text
 * @returns {{verdict: string, confidence: number, reasoning: string}}
 */
export function buildFallbackVerificationResult(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  const verdict = extractVerdict(trimmed);
  const confidence = extractConfidence(trimmed);
  
  return {
    verdict,
    confidence,
    reasoning: trimmed.length > 0 ? trimmed : 'No reasoning provided.'
  };
}

function extractVerdict(text) {
  if (!text) {
    return 'UNVERIFIED';
  }
  
  if (/\bFALSE\b/i.test(text)) {
    return 'FALSE';
  }
  
  if (/\bTRUE\b/i.test(text)) {
    return 'TRUE';
  }
  
  return 'UNVERIFIED';
}

function extractConfidence(text) {
  if (!text) {
    return 0;
  }
  
  const percentMatch = text.match(/(\d{1,3})\s*%/);
  const labelMatch = text.match(/confidence[:\s]+(\d{1,3})/i);
  const raw = percentMatch?.[1] || labelMatch?.[1];
  
  if (!raw) {
    return 0;
  }
  
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    return 0;
  }
  
  return Math.max(0, Math.min(100, value));
}
