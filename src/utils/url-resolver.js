/**
 * TruthSeek URL Resolution Utilities
 * Resolves Google Grounding API redirect URLs to actual source URLs
 */

// Cache for resolved URLs to avoid repeated requests
const urlCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a URL is a Google Grounding redirect URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isGoogleGroundingRedirect(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/');
}

/**
 * Resolve a Google Grounding redirect URL to the actual source URL
 * @param {string} redirectUrl - Google Grounding redirect URL
 * @param {object} options - Resolution options
 * @param {boolean} options.useCache - Whether to use cached results (default: true)
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @returns {Promise<string|null>} Resolved URL or null if resolution fails
 */
export async function resolveGoogleGroundingUrl(redirectUrl, options = {}) {
  const { useCache = true, timeout = 5000 } = options;
  
  if (!isGoogleGroundingRedirect(redirectUrl)) {
    // Not a redirect URL, return as-is
    return redirectUrl;
  }
  
  // Check cache first
  if (useCache) {
    const cached = urlCache.get(redirectUrl);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_TTL) {
        console.log(`[URL_RESOLVER] Using cached URL for ${redirectUrl.substring(0, 50)}...`);
        return cached.resolvedUrl;
      } else {
        // Cache expired, remove it
        urlCache.delete(redirectUrl);
      }
    }
  }
  
  try {
    console.log(`[URL_RESOLVER] Resolving redirect URL: ${redirectUrl.substring(0, 80)}...`);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // Try HEAD request first (more efficient, doesn't download body)
      const response = await fetch(redirectUrl, {
        method: 'HEAD',
        redirect: 'follow', // Automatically follow redirects
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Get final URL from response
      const resolvedUrl = response.url || response.redirected ? response.url : redirectUrl;
      
      // Only cache if we got a different URL
      if (resolvedUrl !== redirectUrl && resolvedUrl) {
        if (useCache) {
          urlCache.set(redirectUrl, {
            resolvedUrl,
            timestamp: Date.now()
          });
        }
        console.log(`[URL_RESOLVER] Resolved to: ${resolvedUrl}`);
        return resolvedUrl;
      }
      
      // If HEAD didn't work or returned same URL, try GET
      console.log(`[URL_RESOLVER] HEAD request didn't resolve, trying GET...`);
      
    } catch (headError) {
      clearTimeout(timeoutId);
      
      // If HEAD fails (CORS, method not allowed, etc.), try GET
      if (headError.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      console.log(`[URL_RESOLVER] HEAD request failed, trying GET: ${headError.message}`);
    }
    
    // Try GET request as fallback
    const getController = new AbortController();
    const getTimeoutId = setTimeout(() => getController.abort(), timeout);
    
    try {
      const response = await fetch(redirectUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(getTimeoutId);
      
      const resolvedUrl = response.url || redirectUrl;
      
      if (resolvedUrl !== redirectUrl && resolvedUrl) {
        if (useCache) {
          urlCache.set(redirectUrl, {
            resolvedUrl,
            timestamp: Date.now()
          });
        }
        console.log(`[URL_RESOLVER] Resolved to (via GET): ${resolvedUrl}`);
        return resolvedUrl;
      }
      
      // If we still got the same URL, it might not be a redirect or it's blocked
      console.warn(`[URL_RESOLVER] Could not resolve redirect, URL unchanged: ${redirectUrl.substring(0, 80)}...`);
      return redirectUrl; // Return original if we can't resolve
      
    } catch (getError) {
      clearTimeout(getTimeoutId);
      
      if (getError.name === 'AbortError') {
        console.warn(`[URL_RESOLVER] Request timeout for: ${redirectUrl.substring(0, 80)}...`);
      } else if (getError.message.includes('CORS') || getError.message.includes('Failed to fetch')) {
        console.warn(`[URL_RESOLVER] CORS error, cannot resolve: ${redirectUrl.substring(0, 80)}...`);
      } else {
        console.warn(`[URL_RESOLVER] Error resolving URL: ${getError.message}`);
      }
      
      // Return original URL if resolution fails
      return redirectUrl;
    }
    
  } catch (error) {
    console.error(`[URL_RESOLVER] Unexpected error resolving URL:`, error);
    return redirectUrl; // Return original on any error
  }
}

/**
 * Resolve multiple URLs in parallel (with batching to avoid overwhelming)
 * @param {string[]} urls - Array of URLs to resolve
 * @param {object} options - Resolution options
 * @param {number} options.batchSize - Number of URLs to resolve in parallel (default: 5)
 * @returns {Promise<string[]>} Array of resolved URLs (same order as input)
 */
export async function resolveUrlsBatch(urls, options = {}) {
  const { batchSize = 5 } = options;
  const resolved = [];
  
  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchPromises = batch.map(url => resolveGoogleGroundingUrl(url, options));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Extract results (fulfilled values or original URLs on rejection)
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        resolved.push(result.value);
      } else {
        // On failure, use original URL
        resolved.push(batch[index]);
      }
    });
  }
  
  return resolved;
}

/**
 * Clear the URL resolution cache
 */
export function clearUrlCache() {
  urlCache.clear();
  console.log('[URL_RESOLVER] Cache cleared');
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
  return {
    size: urlCache.size,
    entries: Array.from(urlCache.entries()).map(([key, value]) => ({
      redirectUrl: key.substring(0, 80) + '...',
      resolvedUrl: value.resolvedUrl.substring(0, 80) + '...',
      age: Date.now() - value.timestamp
    }))
  };
}

