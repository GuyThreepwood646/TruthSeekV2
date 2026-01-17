/**
 * TruthSeek HTML Content Extractor
 * Extracts meaningful text content from web pages while preserving structure for DOM tracking
 */

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB per batch
const EXCLUDED_TAGS = ['SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'ASIDE', 'HEADER', 'NOSCRIPT', 'IFRAME', 'FORM'];
const CONTENT_CONTAINER_TAGS = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'DD', 'DT', 'FIGCAPTION'];
const NAV_KEYWORDS = ['nav', 'menu', 'header', 'footer', 'breadcrumb', 'sidebar', 'masthead', 'topbar'];
const NON_CONTENT_KEYWORDS = [
  'ad',
  'ads',
  'advert',
  'advertisement',
  'promo',
  'promoted',
  'pagepromo',
  'pagelist',
  'sponsor',
  'sponsored',
  'affiliate',
  'sidebar',
  'rail',
  'sticky',
  'related',
  'recommend',
  'recommendation',
  'trending',
  'most-read',
  'mostread',
  'newsletter',
  'subscribe',
  'subscription',
  'signup',
  'sign-in',
  'signin',
  'login',
  'social',
  'share',
  'comment',
  'comments',
  'commentary',
  'cookie',
  'consent',
  'modal',
  'overlay',
  'carousel',
  'gallery',
  'slideshow',
  'lightbox',
  'taboola',
  'outbrain',
  'nativo',
  'freestar',
  'viafoura',
  'vf-',
  'byline',
  'author',
  'timestamp',
  'actions',
  'action',
  'recommendations',
  'related-stories',
  'relatedstories',
  'trc',
  'advertorial'
];
const CANDIDATE_MIN_TEXT = 200;
const MIN_BLOCK_TEXT_STRICT = 60;
const MIN_BLOCK_TEXT_RELAXED = 40;
const MIN_BLOCK_TEXT_FALLBACK = 30;
const MIN_PARAGRAPH_TEXT_STRICT = 200;
const MIN_PARAGRAPH_TEXT_RELAXED = 120;
const MIN_PARAGRAPH_TEXT_FALLBACK = 80;
const MAX_LINK_DENSITY_STRICT = 0.25;
const MAX_LINK_DENSITY_RELAXED = 0.35;
const MAX_LINK_DENSITY_FALLBACK = 0.45;
const MIN_BLOCK_SCORE_STRICT = 4;
const MIN_BLOCK_SCORE_RELAXED = 2;
const MIN_BLOCK_SCORE_FALLBACK = 1;
const CONTENT_HINT_KEYWORDS = [
  'article',
  'content',
  'post',
  'story',
  'entry',
  'body',
  'main',
  'page',
  'text',
  'editorial',
  'news',
  'blog'
];
const STRONG_CONTENT_HINTS = [
  'storybody',
  'richtextstorybody',
  'richtextbody',
  'articlebody',
  'article-body',
  'content-body',
  'entry-content'
];
const EXCLUDED_ROLE_KEYWORDS = [
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
  'menu',
  'menubar',
  'toolbar',
  'dialog',
  'alert'
];
const SENTENCE_NOISE_PATTERNS = [
  /\bsubscribe\b/i,
  /\bsign\s+up\b/i,
  /\bsign\s+in\b/i,
  /\blog\s+in\b/i,
  /\bnewsletter\b/i,
  /\bshare\b/i,
  /\bfollow\s+us\b/i,
  /\badvertisement\b/i,
  /\bsponsored\b/i,
  /\brelated\s+articles?\b/i,
  /\brelated\s+stories?\b/i,
  /\bmost\s+read\b/i,
  /\bpromo\b/i,
  /\bclick\s+here\b/i,
  /\ball\s+rights\s+reserved\b/i,
  /\bterms\s+of\s+use\b/i,
  /\bprivacy\s+policy\b/i,
  /\bcookie\s+settings?\b/i,
  /\bcontinue\s+reading\b/i
];

let contentCache = null;

/**
 * Extract page content with sentence tracking
 * @param {number} batchIndex - Batch index to return
 * @returns {Promise<ExtractedContent>}
 */
export async function extractPageContent(batchIndex = 0) {
  try {
    // Wait for document to be fully loaded
    if (document.readyState !== 'complete') {
      await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
    }
    
    const currentUrl = window.location.href;
    if (contentCache && contentCache.url === currentUrl && contentCache.totalSentences > 0) {
      return buildBatchResponse(contentCache, batchIndex);
    }
    
    // Additional delay for dynamic content (SPAs, lazy loading)
    await sleep(2000);
    
    console.log('[EXTRACTOR] Starting parent-element-based extraction...');
    
    const selection = selectContentRoot();
    const mainFallback = document.querySelector('main, [role="main"], content');
    let searchRoot = selection.element || mainFallback || document.body || document.documentElement;
    
    if (!searchRoot) {
      console.warn('[EXTRACTOR] No content root available');
      return emptyBatchResponse(batchIndex);
    }
    
    if (selection.reason === 'primary') {
      console.log('[EXTRACTOR] Using primary container:', selection.tagName);
    } else if (selection.reason === 'scored') {
      console.log(`[EXTRACTOR] Using scored container: <${selection.tagName}> score=${selection.score} candidates=${selection.candidates}`);
    } else if (!selection.element && mainFallback) {
      console.log('[EXTRACTOR] No suitable container found, using <main> fallback');
    } else {
      console.log('[EXTRACTOR] No suitable container found, using body');
    }
    
    if (isPrimaryRootElement(searchRoot)) {
      const refinedRoot = findDominantContentBlock(searchRoot);
      if (refinedRoot && refinedRoot !== searchRoot) {
        searchRoot = refinedRoot;
        console.log('[EXTRACTOR] Refined main container to dominant content block');
      }
    }
    
    const passes = [
      {
        label: 'strict',
        root: searchRoot,
        allowParents: false,
        excludeMode: 'strict',
        filterLowValue: true,
        forceRootOnly: false,
        minBlockText: MIN_BLOCK_TEXT_STRICT,
        minParagraphText: MIN_PARAGRAPH_TEXT_STRICT,
        maxLinkDensity: MAX_LINK_DENSITY_STRICT,
        minBlockScore: MIN_BLOCK_SCORE_STRICT,
        allowListItems: true
      },
      {
        label: 'relaxed',
        root: searchRoot,
        allowParents: true,
        excludeMode: 'relaxed',
        filterLowValue: false,
        forceRootOnly: false,
        minBlockText: MIN_BLOCK_TEXT_RELAXED,
        minParagraphText: MIN_PARAGRAPH_TEXT_RELAXED,
        maxLinkDensity: MAX_LINK_DENSITY_RELAXED,
        minBlockScore: MIN_BLOCK_SCORE_RELAXED,
        allowListItems: true
      },
      {
        label: 'fallback',
        root: document.body || searchRoot,
        allowParents: true,
        excludeMode: 'minimal',
        filterLowValue: false,
        forceRootOnly: false,
        minBlockText: MIN_BLOCK_TEXT_FALLBACK,
        minParagraphText: MIN_PARAGRAPH_TEXT_FALLBACK,
        maxLinkDensity: MAX_LINK_DENSITY_FALLBACK,
        minBlockScore: MIN_BLOCK_SCORE_FALLBACK,
        allowListItems: true
      }
    ];
    
    let extractionResult = null;
    
    let selectedPass = null;
    for (const pass of passes) {
      extractionResult = extractFromRoot(pass.root, pass);
      console.log(`[EXTRACTOR] Pass "${pass.label}" extracted ${extractionResult.totalSentences} sentences`);
      
      if (extractionResult.totalSentences > 0) {
        selectedPass = pass.label;
        break;
      }
    }
    
    if (!extractionResult || extractionResult.totalSentences === 0) {
      contentCache = null;
      console.warn('[EXTRACTOR] No sentences extracted after all passes');
      return emptyBatchResponse(batchIndex);
    }
    
    console.log(`[EXTRACTOR] Selected pass: ${selectedPass || 'none'}`);
    const rankedBatches = rankBatches(extractionResult.batches);
    const totalSentences = rankedBatches.reduce((sum, batch) => sum + batch.length, 0);
    console.log(`[EXTRACTOR] Extracted ${totalSentences} sentences in ${rankedBatches.length} batches (${extractionResult.totalCharacters} characters)`);
    
    const metadata = extractPageMetadata();
    
    contentCache = {
      url: currentUrl,
      batches: rankedBatches,
      totalCharacters: extractionResult.totalCharacters,
      totalSentences,
      metadata
    };
    
    return buildBatchResponse(contentCache, batchIndex);
    
  } catch (error) {
    console.error('[EXTRACTOR] Error extracting page content:', error);
    throw error;
  }
}

/**
 * Build response for a specific batch
 * @param {object} cache - Cached extraction data
 * @param {number} batchIndex - Batch index
 * @returns {object}
 */
function buildBatchResponse(cache, batchIndex) {
  if (!cache) {
    return emptyBatchResponse(batchIndex);
  }
  const safeIndex = Number.isFinite(batchIndex) && batchIndex >= 0 ? batchIndex : 0;
  const batch = cache.batches[safeIndex] || [];
  const batchCount = cache.batches.length;
  const hasMoreBatches = safeIndex < batchCount - 1;
  
  return {
    sentences: batch,
    truncated: false,
    totalCharacters: cache.totalCharacters,
    batchIndex: safeIndex,
    batchCount,
    hasMoreBatches,
    metadata: cache.metadata || null
  };
}

function emptyBatchResponse(batchIndex = 0) {
  return {
    sentences: [],
    truncated: false,
    totalCharacters: 0,
    batchIndex: Number.isFinite(batchIndex) && batchIndex >= 0 ? batchIndex : 0,
    batchCount: 0,
    hasMoreBatches: false,
    metadata: null
  };
}

/**
 * Locate the primary content container (main/article/body fallback)
 * @returns {Element|null}
 */
function findPrimaryContentContainer() {
  const candidates = [
    document.querySelector('article, [itemprop="articleBody"]'),
    document.querySelector('main, [role="main"], content')
  ].filter(Boolean);
  
  let best = null;
  let bestScore = -Infinity;
  
  for (const candidate of candidates) {
    if (!isPrimaryContentCandidate(candidate)) {
      continue;
    }
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  
  return best;
}

/**
 * Find content container using class/id hints
 * @returns {{element: Element, score: number}|null}
 */
function findHintedContentContainer() {
  if (!document.body) {
    return null;
  }
  
  const nodes = Array.from(document.body.querySelectorAll('article, main, content, section, div'));
  let best = null;
  let bestScore = -Infinity;
  
  for (const node of nodes) {
    if (!node || shouldExcludeElement(node)) {
      continue;
    }
    
    const textLength = (node.textContent || '').trim().length;
    if (textLength < CANDIDATE_MIN_TEXT) {
      continue;
    }
    
    const hintStrength = getContentHintStrength(node);
    if (hintStrength === 0) {
      continue;
    }
    
    if (!isPrimaryRootElement(node) && hasHighLinkDensity(node)) {
      continue;
    }
    
    const score = scoreContentBlock(node) + hintStrength * 4;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  
  if (!best) {
    return null;
  }
  
  return { element: best, score: Math.round(bestScore) };
}

/**
 * Find the dominant paragraph-heavy content block within a root
 * @param {Element} root - Root element to search within
 * @returns {Element|null}
 */
function findDominantContentBlock(root) {
  if (!root) {
    return null;
  }
  
  const nodes = Array.from(root.querySelectorAll('article, section, div'));
  let best = null;
  let bestScore = -Infinity;
  
  for (const node of nodes) {
    if (!node || shouldExcludeElement(node)) {
      continue;
    }
    
    const paragraphTextLength = getParagraphTextLength(node);
    const paragraphCount = getParagraphCount(node);
    if (paragraphTextLength < MIN_PARAGRAPH_TEXT_RELAXED || paragraphCount < 2) {
      continue;
    }
    
    if (hasHighLinkDensity(node)) {
      continue;
    }
    
    const score = paragraphTextLength + paragraphCount * 50 + getContentHintScore(node) * 10;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  
  return best;
}

function extractPageMetadata() {
  const metadata = {
    title: null,
    description: null,
    canonicalUrl: null,
    siteName: null,
    publishedTime: null,
    modifiedTime: null,
    author: null,
    section: null,
    keywords: null,
    language: null,
    source: []
  };
  
  metadata.title = firstNonEmpty([
    getMetaContent('meta[property="og:title"]'),
    getMetaContent('meta[name="twitter:title"]'),
    getMetaContent('meta[name="title"]'),
    document.title
  ]);
  
  metadata.description = firstNonEmpty([
    getMetaContent('meta[property="og:description"]'),
    getMetaContent('meta[name="twitter:description"]'),
    getMetaContent('meta[name="description"]')
  ]);
  
  metadata.canonicalUrl = firstNonEmpty([
    getMetaContent('link[rel="canonical"]', 'href'),
    getMetaContent('meta[property="og:url"]')
  ]);
  
  metadata.siteName = firstNonEmpty([
    getMetaContent('meta[property="og:site_name"]')
  ]);
  
  metadata.publishedTime = firstNonEmpty([
    getMetaContent('meta[property="article:published_time"]'),
    getMetaContent('meta[name="article:published_time"]')
  ]);
  
  metadata.modifiedTime = firstNonEmpty([
    getMetaContent('meta[property="article:modified_time"]'),
    getMetaContent('meta[name="article:modified_time"]')
  ]);
  
  metadata.author = firstNonEmpty([
    getMetaContent('meta[name="author"]'),
    getMetaContent('meta[property="article:author"]')
  ]);
  
  metadata.section = firstNonEmpty([
    getMetaContent('meta[property="article:section"]'),
    getMetaContent('meta[name="article:section"]')
  ]);
  
  metadata.keywords = firstNonEmpty([
    getMetaContent('meta[name="keywords"]'),
    getMetaContent('meta[property="article:tag"]')
  ]);
  
  metadata.language = firstNonEmpty([
    document.documentElement?.getAttribute('lang'),
    getMetaContent('meta[name="language"]')
  ]);
  
  const schema = extractArticleSchemaMetadata();
  if (schema) {
    metadata.title = firstNonEmpty([metadata.title, schema.title]);
    metadata.description = firstNonEmpty([metadata.description, schema.description]);
    metadata.publishedTime = firstNonEmpty([metadata.publishedTime, schema.publishedTime]);
    metadata.modifiedTime = firstNonEmpty([metadata.modifiedTime, schema.modifiedTime]);
    metadata.author = firstNonEmpty([metadata.author, schema.author]);
    metadata.section = firstNonEmpty([metadata.section, schema.section]);
    metadata.keywords = firstNonEmpty([metadata.keywords, schema.keywords]);
    metadata.siteName = firstNonEmpty([metadata.siteName, schema.publisher]);
    metadata.source.push('ld+json');
  }
  
  trimMetadata(metadata);
  
  if (metadata.title || metadata.publishedTime || metadata.modifiedTime || metadata.author || metadata.section) {
    return metadata;
  }
  
  return null;
}

function extractArticleSchemaMetadata() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text.trim()) {
      continue;
    }
    
    const parsed = safeParseJson(text);
    if (!parsed) {
      continue;
    }
    
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      const article = findArticleSchema(candidate);
      if (!article) {
        continue;
      }
      
      return {
        title: article.headline || article.name || null,
        description: article.description || null,
        publishedTime: article.datePublished || null,
        modifiedTime: article.dateModified || article.dateUpdated || null,
        author: extractAuthorName(article.author),
        section: article.articleSection || null,
        keywords: Array.isArray(article.keywords) ? article.keywords.join(', ') : article.keywords || null,
        publisher: extractPublisherName(article.publisher)
      };
    }
  }
  
  return null;
}

function findArticleSchema(node) {
  if (!node || typeof node !== 'object') {
    return null;
  }
  
  if (matchesArticleType(node['@type'])) {
    return node;
  }
  
  const graph = node['@graph'];
  if (Array.isArray(graph)) {
    for (const item of graph) {
      if (matchesArticleType(item?.['@type'])) {
        return item;
      }
    }
  }
  
  return null;
}

function matchesArticleType(type) {
  if (!type) {
    return false;
  }
  const types = Array.isArray(type) ? type : [type];
  return types.some(value => {
    const normalized = String(value).toLowerCase();
    return normalized.includes('newsarticle') || normalized.includes('article') || normalized.includes('report');
  });
}

function extractAuthorName(author) {
  if (!author) {
    return null;
  }
  if (typeof author === 'string') {
    return author;
  }
  if (Array.isArray(author)) {
    const names = author.map(item => extractAuthorName(item)).filter(Boolean);
    return names.length > 0 ? names.join(', ') : null;
  }
  return author.name || null;
}

function extractPublisherName(publisher) {
  if (!publisher) {
    return null;
  }
  if (typeof publisher === 'string') {
    return publisher;
  }
  return publisher.name || null;
}

function getMetaContent(selector, attribute = 'content') {
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const value = element.getAttribute(attribute);
  return value ? value.trim() : null;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function trimMetadata(metadata) {
  if (!metadata) {
    return;
  }
  metadata.title = truncateText(metadata.title, 200);
  metadata.description = truncateText(metadata.description, 300);
  metadata.author = truncateText(metadata.author, 120);
  metadata.section = truncateText(metadata.section, 80);
  metadata.keywords = truncateText(metadata.keywords, 200);
  metadata.siteName = truncateText(metadata.siteName, 120);
}

function truncateText(text, limit) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return trimmed.slice(0, limit).trim();
}

/**
 * Select best content root using primary tags or scored candidates
 * @returns {{element: Element|null, reason: string, score: number|null, candidates: number, tagName: string|null}}
 */
function selectContentRoot() {
  const primary = findPrimaryContentContainer();
  const hinted = findHintedContentContainer();
  const candidates = collectCandidateContainers();
  const best = selectBestCandidate(candidates);
  
  if (hinted) {
    return {
      element: hinted.element,
      reason: 'hinted',
      score: hinted.score,
      candidates: candidates.length,
      tagName: hinted.element.tagName.toLowerCase()
    };
  }
  if (primary) {
    const primaryScore = scoreCandidate(primary);
    if (!best || best.score <= primaryScore * 1.15) {
      return {
        element: primary,
        reason: 'primary',
        score: Math.round(primaryScore),
        candidates: candidates.length,
        tagName: primary.tagName.toLowerCase()
      };
    }
  }
  
  if (best) {
    return {
      element: best.element,
      reason: 'scored',
      score: best.score,
      candidates: candidates.length,
      tagName: best.element.tagName.toLowerCase()
    };
  }
  
  return {
    element: null,
    reason: 'body',
    score: null,
    candidates: candidates.length,
    tagName: null
  };
}

/**
 * Collect candidate containers for scoring
 * @returns {Element[]}
 */
function collectCandidateContainers() {
  if (!document.body) {
    return [];
  }
  const selector = [
    'main',
    '[role="main"]',
    'content',
    'article',
    '[itemprop="articleBody"]',
    'section',
    'div'
  ].join(',');
  
  const nodes = Array.from(document.body.querySelectorAll(selector));
  const unique = new Set();
  const candidates = [];
  
  for (const node of nodes) {
    if (!node || unique.has(node)) {
      continue;
    }
    
    unique.add(node);
    
    if (shouldExcludeElement(node)) {
      continue;
    }
    
    const textLength = (node.textContent || '').trim().length;
    const paragraphCount = node.querySelectorAll('p').length;
    const paragraphTextLength = getParagraphTextLength(node);
    if (textLength < CANDIDATE_MIN_TEXT && paragraphTextLength < MIN_PARAGRAPH_TEXT_RELAXED && paragraphCount < 2) {
      continue;
    }
    
    candidates.push(node);
  }
  
  return candidates;
}

/**
 * Score and select the best candidate container
 * @param {Element[]} candidates - Candidate containers
 * @returns {{element: Element, score: number}|null}
 */
function selectBestCandidate(candidates) {
  let best = null;
  let bestScore = -Infinity;
  
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  
  if (!best) {
    return null;
  }
  
  return { element: best, score: Math.round(bestScore) };
}

/**
 * Score a content candidate (recall-biased)
 * @param {Element} element - Candidate element
 * @returns {number}
 */
function scoreCandidate(element) {
  const text = element.textContent || '';
  const textLength = text.trim().length;
  if (textLength < CANDIDATE_MIN_TEXT) {
    return -Infinity;
  }
  
  let score = scoreContentBlock(element);
  
  if (element.matches('main, [role="main"]')) {
    score += 8;
  }
  if (element.matches('article, [itemprop="articleBody"]')) {
    score += 12;
  }
  if ((element.getAttribute('itemprop') || '').toLowerCase() === 'articlebody') {
    score += 10;
  }
  
  return score;
}

/**
 * Basic sanity checks for primary content container
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function isPrimaryContentCandidate(element) {
  if (shouldExcludeElement(element)) {
    return false;
  }
  
  const text = element.textContent || '';
  const trimmedLength = text.trim().length;
  const paragraphTextLength = getParagraphTextLength(element);
  if (trimmedLength < CANDIDATE_MIN_TEXT && paragraphTextLength < MIN_PARAGRAPH_TEXT_RELAXED) {
    return false;
  }
  
  if (isPrimaryRootElement(element)) {
    return true;
  }
  
  return !hasHighLinkDensity(element);
}

/**
 * Check if element should be excluded from extraction
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function shouldExcludeElement(element, mode = 'strict') {
  // Check if element itself is excluded
  if (EXCLUDED_TAGS.includes(element.tagName)) {
    return true;
  }
  
  const role = (element.getAttribute('role') || '').toLowerCase();
  if (role && EXCLUDED_ROLE_KEYWORDS.includes(role)) {
    return true;
  }
  
  if (mode === 'strict') {
    if (isNavigationLike(element) || isNonContentLike(element)) {
      return true;
    }
    
    if (!isPrimaryRootElement(element) && hasHighLinkDensity(element)) {
      return true;
    }
  }
  
  // Check if element is hidden
  if (element.hasAttribute('hidden') || element.hasAttribute('inert')) {
    return true;
  }
  if (element.getAttribute('aria-hidden') === 'true') {
    return true;
  }
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }
  
  // Check if any parent is excluded
  let parent = element.parentElement;
  while (parent) {
    if (EXCLUDED_TAGS.includes(parent.tagName)) {
      return true;
    }
    
    const parentRole = (parent.getAttribute('role') || '').toLowerCase();
    if (parentRole && EXCLUDED_ROLE_KEYWORDS.includes(parentRole)) {
      return true;
    }
    
    if (mode === 'strict') {
      if (isNavigationLike(parent)) {
        return true;
      }
      
      if (isNonContentLike(parent)) {
        return true;
      }
    }
    
    if (parent.hasAttribute('hidden') || parent.hasAttribute('inert')) {
      return true;
    }
    
    if (parent.getAttribute('aria-hidden') === 'true') {
      return true;
    }
    
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return true;
    }
    
    parent = parent.parentElement;
  }
  
  return false;
}

function extractFromRoot(searchRoot, options) {
  const {
    allowParents,
    excludeMode,
    filterLowValue,
    forceRootOnly,
    minBlockText = MIN_BLOCK_TEXT_RELAXED,
    minParagraphText = MIN_PARAGRAPH_TEXT_RELAXED,
    maxLinkDensity = MAX_LINK_DENSITY_RELAXED,
    minBlockScore = MIN_BLOCK_SCORE_RELAXED,
    allowListItems = true
  } = options;
  
  let totalCharacters = 0;
  let sentenceIndex = 0;
  let orderIndex = 0;
  const batches = [];
  let currentBatch = [];
  let currentBatchCharacters = 0;
  const seenSentences = new Set();
  
  let contentElements;
  const selectorTags = allowListItems
    ? CONTENT_CONTAINER_TAGS
    : CONTENT_CONTAINER_TAGS.filter(tag => tag !== 'LI');
  
  if (forceRootOnly) {
    contentElements = [searchRoot];
  } else {
    contentElements = Array.from(searchRoot.querySelectorAll(selectorTags.join(',')));
  }
  
  const contentSet = new Set(contentElements);
  const hasContentChild = new Set();
  
  if (!allowParents) {
    for (const element of contentElements) {
      let parent = element.parentElement;
      while (parent) {
        if (contentSet.has(parent)) {
          hasContentChild.add(parent);
        }
        parent = parent.parentElement;
      }
    }
  }
  
  console.log(`[EXTRACTOR] Found ${contentElements.length} content elements to process`);
  
  for (const element of contentElements) {
    if (!element) {
      continue;
    }
    
    if (!allowParents && hasContentChild.has(element)) {
      continue;
    }
    
    if (!forceRootOnly && shouldExcludeElement(element, excludeMode)) {
      continue;
    }
    
    const fullText = element.textContent?.trim() || '';
    if (fullText.length === 0) {
      continue;
    }
    
    if (fullText.split(/\s+/).length < 5) {
      continue;
    }
    
    if (!allowListItems && element.tagName === 'LI') {
      continue;
    }
    
    if (fullText.length < minBlockText) {
      continue;
    }
    
    const linkDensity = getLinkDensity(element);
    if (linkDensity > maxLinkDensity) {
      continue;
    }
    
    const paragraphTextLength = getParagraphTextLength(element);
    if (paragraphTextLength > 0 && paragraphTextLength < minParagraphText && element.tagName !== 'P') {
      continue;
    }
    
    const blockScore = scoreContentBlock(element);
    if (blockScore < minBlockScore) {
      continue;
    }
    
    const elementSentences = splitIntoSentences(fullText);
    if (elementSentences.length === 0) {
      continue;
    }
    
    const elementXPath = getXPath(element);
    
    for (const sentenceText of elementSentences) {
      const sanitized = sanitizeText(sentenceText);
      if (sanitized.length < 10) {
        continue;
      }
      
      const segments = splitOversizedSentence(sanitized);
      
      for (const segment of segments) {
        const normalized = normalizeSentenceText(segment);
        if (normalized.length === 0 || seenSentences.has(normalized)) {
          continue;
        }
        
        const segmentBytes = getByteLength(segment);
        if (segmentBytes > MAX_CONTENT_SIZE) {
          console.warn('[EXTRACTOR] Skipping oversized sentence segment');
          continue;
        }
        
        if (filterLowValue) {
          const score = scoreSentence(segment);
          if (isLowValueSentence(segment, score)) {
            continue;
          }
        }
        
        if (currentBatchCharacters + segmentBytes > MAX_CONTENT_SIZE && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchCharacters = 0;
        }
        
        const sentence = {
          id: `s-${sentenceIndex.toString().padStart(4, '0')}`,
          text: segment,
          xpath: elementXPath,
          elementTag: element.tagName?.toLowerCase() || 'root',
          score: filterLowValue ? scoreSentence(segment) : 0,
          orderIndex
        };
        
        sentenceIndex++;
        orderIndex++;
        seenSentences.add(normalized);
        currentBatch.push(sentence);
        currentBatchCharacters += segmentBytes;
        totalCharacters += segmentBytes;
      }
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  const totalSentences = batches.reduce((sum, batch) => sum + batch.length, 0);
  
  return {
    batches,
    totalCharacters,
    totalSentences
  };
}

/**
 * Build a normalized descriptor string for keyword matching
 * @param {Element} element - DOM element
 * @returns {string}
 */
function getElementDescriptor(element) {
  const className = (element.className || '').toString().toLowerCase();
  const elementId = (element.id || '').toString().toLowerCase();
  const role = (element.getAttribute('role') || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const dataTestId = (element.getAttribute('data-testid') || '').toLowerCase();
  const dataTest = (element.getAttribute('data-test-id') || '').toLowerCase();
  const dataQa = (element.getAttribute('data-qa') || '').toLowerCase();
  
  return `${className} ${elementId} ${role} ${ariaLabel} ${dataTestId} ${dataTest} ${dataQa}`.trim();
}

/**
 * Check if element is a primary root container
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function isPrimaryRootElement(element) {
  if (!element) {
    return false;
  }
  
  const tagName = element.tagName?.toUpperCase() || '';
  if (tagName === 'MAIN' || tagName === 'CONTENT') {
    return true;
  }
  
  const role = (element.getAttribute('role') || '').toLowerCase();
  return role === 'main';
}

/**
 * Count content hint strength from descriptor
 * @param {Element} element - DOM element
 * @returns {number}
 */
function getContentHintStrength(element) {
  const descriptor = getElementDescriptor(element);
  if (!descriptor) {
    return 0;
  }
  
  let score = 0;
  for (const keyword of CONTENT_HINT_KEYWORDS) {
    if (descriptor.includes(keyword)) {
      score += 1;
    }
  }
  for (const keyword of STRONG_CONTENT_HINTS) {
    if (descriptor.includes(keyword)) {
      score += 3;
    }
  }
  
  return score;
}

/**
 * Score element based on content/boilerplate hints in attributes
 * @param {Element} element - DOM element
 * @returns {number}
 */
function getContentHintScore(element) {
  const descriptor = getElementDescriptor(element);
  if (!descriptor) {
    return 0;
  }
  
  let score = getContentHintStrength(element) * 2;
  for (const keyword of NON_CONTENT_KEYWORDS) {
    if (descriptor.includes(keyword)) {
      score -= 3;
    }
  }
  
  return score;
}

/**
 * Check if element is likely navigation or chrome
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function isNavigationLike(element) {
  const role = element.getAttribute('role') || '';
  if (role === 'navigation' || role === 'banner' || role === 'menubar' || role === 'menu') {
    return true;
  }
  
  const descriptor = getElementDescriptor(element);
  return NAV_KEYWORDS.some(keyword => descriptor.includes(keyword));
}

/**
 * Check if element is likely ads/related/utility content
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function isNonContentLike(element) {
  const descriptor = getElementDescriptor(element);
  return NON_CONTENT_KEYWORDS.some(keyword => descriptor.includes(keyword));
}

/**
 * Check if element is mostly navigation links
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function hasHighLinkDensity(element) {
  const text = element.textContent || '';
  const totalLength = text.trim().length;
  if (totalLength === 0) {
    return true;
  }
  
  const links = element.querySelectorAll('a');
  if (links.length === 0) {
    return false;
  }
  
  let linkTextLength = 0;
  links.forEach(link => {
    linkTextLength += (link.textContent || '').trim().length;
  });
  
  const linkDensity = linkTextLength / totalLength;
  return linkDensity >= 0.6 && totalLength < 300;
}

/**
 * Get link density for scoring
 * @param {Element} element - DOM element
 * @returns {number}
 */
function getLinkDensity(element) {
  const text = element.textContent || '';
  const totalLength = text.trim().length;
  if (totalLength === 0) {
    return 1;
  }
  
  const links = element.querySelectorAll('a');
  if (links.length === 0) {
    return 0;
  }
  
  let linkTextLength = 0;
  links.forEach(link => {
    linkTextLength += (link.textContent || '').trim().length;
  });
  
  return linkTextLength / totalLength;
}

/**
 * Get total paragraph text length within an element
 * @param {Element} element - DOM element
 * @returns {number}
 */
function getParagraphTextLength(element) {
  if (!element) {
    return 0;
  }
  
  if (element.tagName === 'P') {
    return (element.textContent || '').trim().length;
  }
  
  const paragraphs = element.querySelectorAll('p');
  if (paragraphs.length === 0) {
    return 0;
  }
  
  let total = 0;
  paragraphs.forEach(p => {
    total += (p.textContent || '').trim().length;
  });
  
  return total;
}

/**
 * Get paragraph count for scoring
 * @param {Element} element - DOM element
 * @returns {number}
 */
function getParagraphCount(element) {
  if (!element) {
    return 0;
  }
  
  if (element.tagName === 'P') {
    return 1;
  }
  
  return element.querySelectorAll('p').length;
}

/**
 * Score a content block for extraction suitability
 * @param {Element} element - DOM element
 * @returns {number}
 */
function scoreContentBlock(element) {
  if (!element) {
    return -Infinity;
  }
  
  const text = element.textContent || '';
  const textLength = text.trim().length;
  if (textLength === 0) {
    return -Infinity;
  }
  
  const paragraphCount = getParagraphCount(element);
  const paragraphTextLength = getParagraphTextLength(element);
  const headingCount = element.querySelectorAll('h1, h2, h3').length;
  const linkDensity = getLinkDensity(element);
  const listItemCount = element.querySelectorAll('li').length;
  
  let score = 0;
  score += Math.min(paragraphTextLength / 80, 25);
  score += Math.min(textLength / 200, 10);
  score += paragraphCount * 2;
  score += headingCount * 1.5;
  score -= linkDensity * 20;
  score += getContentHintScore(element);
  
  if (listItemCount > paragraphCount * 3 && paragraphCount < 2) {
    score -= 6;
  }
  
  if (isNonContentLike(element) || isNavigationLike(element)) {
    score -= 10;
  }
  
  return score;
}

/**
 * Split text into sentences
 * @param {string} text - Text block
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  // Use Intl.Segmenter if available (modern browsers)
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined') {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
      const segments = Array.from(segmenter.segment(text));
      return segments
        .map(s => s.segment.trim())
        .filter(s => s.length > 10); // Minimum sentence length
    } catch (e) {
      // Fall through to regex method
    }
  }
  
  // Fallback: regex-based splitting
  // Handle common abbreviations to avoid false splits
  let normalized = text
    .replace(/Mr\./g, 'Mr')
    .replace(/Mrs\./g, 'Mrs')
    .replace(/Ms\./g, 'Ms')
    .replace(/Dr\./g, 'Dr')
    .replace(/Prof\./g, 'Prof')
    .replace(/vs\./g, 'vs')
    .replace(/etc\./g, 'etc')
    .replace(/e\.g\./g, 'eg')
    .replace(/i\.e\./g, 'ie')
    .replace(/Inc\./g, 'Inc')
    .replace(/Ltd\./g, 'Ltd')
    .replace(/Co\./g, 'Co');
  
  // Split on sentence boundaries
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 10); // Minimum sentence length
}

/**
 * Generate XPath for a node (element or text node)
 * @param {Node} node - DOM node
 * @returns {string}
 */
export function getXPath(node) {
  const parts = [];
  let current = node;
  
  while (current && current.nodeType !== Node.DOCUMENT_NODE) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const tagName = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentNode?.children || [])
        .filter(el => el.tagName === current.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tagName}[${index}]`);
      } else {
        parts.unshift(tagName);
      }
      
      current = current.parentNode;
    } else if (current.nodeType === Node.TEXT_NODE) {
      const textNodes = Array.from(current.parentNode?.childNodes || [])
        .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
      
      if (textNodes.length > 1) {
        const index = textNodes.indexOf(current) + 1;
        parts.unshift(`text()[${index}]`);
      } else {
        parts.unshift('text()');
      }
      
      current = current.parentNode;
    } else {
      // Skip other node types
      current = current.parentNode;
    }
  }
  
  return '//' + parts.join('/');
}

/**
 * Sanitize text content
 * @param {string} text - Raw text
 * @returns {string}
 */
function sanitizeText(text) {
  return text
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Normalize sentence for deduplication
 * @param {string} text - Sentence text
 * @returns {string}
 */
function normalizeSentenceText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get byte length for a string
 * @param {string} text - Text to measure
 * @returns {number}
 */
function getByteLength(text) {
  return new TextEncoder().encode(text).length;
}

/**
 * Split an oversized sentence into smaller segments
 * @param {string} text - Sentence text
 * @returns {string[]}
 */
function splitOversizedSentence(text) {
  const byteLength = getByteLength(text);
  if (byteLength <= MAX_CONTENT_SIZE) {
    return [text];
  }
  
  const clauses = text.split(/(?<=[,;:])\s+/);
  const segments = [];
  
  for (const clause of clauses) {
    if (getByteLength(clause) <= MAX_CONTENT_SIZE) {
      segments.push(clause.trim());
      continue;
    }
    
    segments.push(...splitByWords(clause));
  }
  
  console.warn(`[EXTRACTOR] Split oversized sentence (${byteLength} bytes) into ${segments.length} segments`);
  return segments.filter(segment => segment.trim().length > 0);
}

/**
 * Split text by words to fit within byte limit
 * @param {string} text - Text to split
 * @returns {string[]}
 */
function splitByWords(text) {
  const words = text.split(/\s+/);
  const segments = [];
  let current = '';
  
  for (const word of words) {
    if (getByteLength(word) > MAX_CONTENT_SIZE) {
      console.warn('[EXTRACTOR] Skipping oversized token');
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (getByteLength(candidate) <= MAX_CONTENT_SIZE) {
      current = candidate;
      continue;
    }
    
    if (current) {
      segments.push(current);
    }
    current = word;
  }
  
  if (current) {
    segments.push(current);
  }
  
  return segments;
}

/**
 * Rank sentences within each batch by score
 * @param {Array<Array<object>>} batches - Sentence batches
 * @returns {Array<Array<object>>}
 */
function rankBatches(batches) {
  return batches.map(batch => {
    const sorted = [...batch].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.orderIndex - b.orderIndex;
    });
    
    return sorted.map(sentence => ({
      id: sentence.id,
      text: sentence.text,
      xpath: sentence.xpath,
      elementTag: sentence.elementTag
    }));
  });
}

/**
 * Score a sentence for information density
 * @param {string} text - Sentence text
 * @returns {number}
 */
function scoreSentence(text) {
  const lengthScore = Math.min(text.length / 120, 6);
  const numberScore = /\d/.test(text) ? 2 : 0;
  const yearScore = /\b(19[0-9]{2}|20[0-2][0-9])\b/.test(text) ? 2 : 0;
  const quoteScore = /["“”'‘’]/.test(text) ? 1 : 0;
  const percentScore = /%|\bpercent\b/i.test(text) ? 1 : 0;
  const noisePenalty = SENTENCE_NOISE_PATTERNS.some(pattern => pattern.test(text)) ? -3 : 0;
  
  return lengthScore + numberScore + yearScore + quoteScore + percentScore + noisePenalty;
}

/**
 * Decide if a sentence is low-value boilerplate
 * @param {string} text - Sentence text
 * @param {number} score - Sentence score
 * @returns {boolean}
 */
function isLowValueSentence(text, score) {
  if (SENTENCE_NOISE_PATTERNS.some(pattern => pattern.test(text)) && text.length < 200) {
    return true;
  }
  
  return score < 0 && text.length < 120;
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

