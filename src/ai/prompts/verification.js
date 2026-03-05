/**
 * TruthSeek Verification Prompts
 * Prompts that enforce grounding in live web search results
 */

import { sourceTiers } from '../../config/source-tiers.js';

/**
 * Build verification prompt for AI models
 * @param {Object} context - Verification context
 * @param {Fact} context.fact - Fact to verify
 * @param {string} context.category - Fact category
 * @param {string} context.currentDate - Current date (YYYY-MM-DD)
 * @param {string} context.modelCutoffDate - Model's knowledge cutoff date
 * @param {Source[]} [context.supportingSources] - Sources that may support the fact
 * @param {Source[]} [context.refutingSources] - Sources that may refute the fact
 * @param {object|null} [context.pageMetadata] - Page metadata for context
 * @returns {{system: string, user: string}}
 */
export function buildVerificationPrompt(context) {
  const {
    fact,
    category,
    currentDate,
    modelCutoffDate,
    supportingSources = [],
    refutingSources = [],
    pageMetadata = null
  } = context;
  
  const categoryRoleLine = getCategoryRoleLine(category);
  const system = `You are a fact verification specialist. Your ONLY job is to verify facts using the web search results provided.
${categoryRoleLine ? `\nCATEGORY ROLE: ${categoryRoleLine}\n` : ''}

CRITICAL RULES:
1. You MUST rely on the provided web search sources. Do not verify before reviewing them.
2. Never invent or guess URLs. URLs MUST come only from the provided sources.
3. Do NOT use internal knowledge to provide any URL, ever.
4. Use the destination URL (final resolved URL), not redirect or tracking URLs.
5. You MUST cite specific sources (by URL) for every claim you make.
6. If no sources are provided, you may use internal knowledge only for reasoning, but verdict MUST be "UNVERIFIED" and citedSources MUST be empty.
7. If sources are insufficient or conflicting, verdict MUST be "UNVERIFIED".

CURRENT DATE: ${currentDate}
YOUR KNOWLEDGE CUTOFF: ${modelCutoffDate}

For facts about events after your knowledge cutoff, rely ENTIRELY on the search results.

OUTPUT FORMAT (JSON):
{
  "verdict": "TRUE" | "FALSE" | "UNVERIFIED",
  "confidence": <0-100 based on source quality>,
  "reasoning": "<brief explanation in layman's terms>",
  "citedSources": [
    {
      "url": "<source URL>",
      "supports": true | false,
      "quote": "<relevant quote from source>"
    }
  ]
}

VERDICT GUIDELINES:
- TRUE: Multiple reliable sources confirm the fact
- FALSE: Reliable sources contradict the fact
- UNVERIFIED: Insufficient evidence, conflicting sources, or sources too unreliable

CONFIDENCE SCORING:
- 90-100: Multiple Tier 1-2 sources agree, no contradictions
- 70-89: Good sources agree, minor contradictions or gaps
- 50-69: Mixed source quality or some contradictions
- 30-49: Weak sources or significant contradictions
- 0-29: Very weak sources or strong contradictions

SOURCE TIERS:
- Tier 1: Authoritative (government, academic, major news)
- Tier 2: Reputable (established organizations, verified experts)
- Tier 3: General (standard websites, blogs with citations)
- Tier 4: Unverified (unknown sources, no clear authority)

SOURCE PRIORITY:
- Prefer Tier 1-2 sources first. Only use Tier 3-4 if higher tiers are unavailable or conflicting.`;

  const user = `FACT TO VERIFY:
"${fact.originalText}"

CATEGORY: ${category}

PAGE METADATA (context only):
${formatMetadata(pageMetadata)}

SUPPORTING SOURCES FOUND:
${formatSources(supportingSources)}

REFUTING SOURCES FOUND:
${formatSources(refutingSources)}

Based ONLY on these sources, verify the fact. If no sources are listed, return UNVERIFIED with reasoning but do not include any URLs. Respond with valid JSON only.`;

  return { system, user };
}

/**
 * Format sources for prompt
 * @param {Source[]} sources - Array of sources
 * @returns {string}
 * @private
 */
function formatSources(sources) {
  if (!sources || sources.length === 0) {
    return 'No sources found.';
  }
  
  const formatted = sources.map((source, index) => {
    const tierLabel = getTierLabel(source.tier);
    return `[${index + 1}] ${source.url}
Title: ${source.title || 'N/A'}
Snippet: ${source.snippet || 'N/A'}
Domain Tier: ${tierLabel} (Tier ${source.tier})`;
  }).join('\n\n');
  
  return formatted;
}

/**
 * Get human-readable tier label
 * @param {number} tier - Tier number (1-4)
 * @returns {string}
 * @private
 */
function getTierLabel(tier) {
  const labels = {
    1: 'Authoritative',
    2: 'Reputable',
    3: 'General',
    4: 'Unverified'
  };
  return labels[tier] || 'Unknown';
}

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return 'None provided.';
  }
  
  const lines = [];
  if (metadata.title) lines.push(`Title: ${metadata.title}`);
  if (metadata.publishedTime) lines.push(`Published: ${metadata.publishedTime}`);
  if (metadata.modifiedTime) lines.push(`Updated: ${metadata.modifiedTime}`);
  if (metadata.section) lines.push(`Section: ${metadata.section}`);
  if (metadata.siteName) lines.push(`Publisher: ${metadata.siteName}`);
  if (metadata.author) lines.push(`Author: ${metadata.author}`);
  if (metadata.canonicalUrl) lines.push(`Canonical URL: ${metadata.canonicalUrl}`);
  if (metadata.keywords) lines.push(`Keywords: ${metadata.keywords}`);
  if (metadata.language) lines.push(`Language: ${metadata.language}`);
  
  return lines.length > 0 ? lines.join('\n') : 'None provided.';
}

function getCategoryRoleLine(category) {
  const roles = {
    HISTORICAL_EVENT: 'Prioritize archival records, primary sources, and official historical registries.',
    STATISTICAL_QUANTITATIVE: 'Prioritize official statistics, datasets, and methodology notes from authoritative agencies.',
    DEFINITIONAL_ATTRIBUTE: 'Prioritize authoritative reference works, standards bodies, and official definitions.',
    SCIENTIFIC_TECHNICAL: 'Prioritize peer-reviewed papers, standards, and primary technical documentation.',
    MEDICAL_BIOLOGICAL: 'Prioritize clinical guidelines, regulatory labels, and peer-reviewed medical research.',
    LEGAL_REGULATORY: 'Prioritize statutes, regulations, court opinions, and official legal repositories.',
    GEOPOLITICAL_SOCIAL: 'Prioritize official government publications, international organizations, and policy reports.',
    ATTRIBUTION_QUOTE: 'Prioritize primary sources: transcripts, official statements, and original recordings.',
    CAUSAL_RELATIONAL: 'Prioritize studies with clear methodology and evidence of causality or correlation.'
  };
  
  return roles[category] || '';
}

function getPreferredDomains(category, limit = 6) {
  const domainSet = new Set();
  const addDomain = (pattern, tier) => {
    if (tier > 2) {
      return;
    }
    const normalized = normalizePattern(pattern);
    if (normalized) {
      domainSet.add(normalized);
    }
  };
  
  if (category && sourceTiers.categoryOverrides?.[category]) {
    for (const mapping of sourceTiers.categoryOverrides[category]) {
      addDomain(mapping.pattern, mapping.tier);
    }
  }
  
  for (const mapping of sourceTiers.globalDefaults || []) {
    addDomain(mapping.pattern, mapping.tier);
  }
  
  return Array.from(domainSet).slice(0, limit);
}

function normalizePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return '';
  }
  
  if (pattern.startsWith('*.')) {
    return `.${pattern.substring(2)}`;
  }
  
  if (pattern.includes('*')) {
    return '';
  }
  
  return pattern;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return '';
  }
}

function dedupeQueries(queries, limit = 4) {
  const seen = new Set();
  const results = [];
  
  for (const query of queries) {
    const trimmed = query?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    results.push(trimmed);
    if (results.length >= limit) {
      break;
    }
  }
  
  return results;
}

/**
 * Build search query for fact verification
 * @param {Fact} fact - Fact to verify
 * @param {string} direction - 'supporting' or 'refuting'
 * @returns {string}
 */
export function buildSearchQuery(fact, direction = 'supporting') {
  // Use the searchableText as base
  let query = fact.searchableText;
  
  if (direction === 'refuting') {
    // Add refuting keywords to find contradicting sources
    query = `${query} false debunked myth incorrect`;
  }
  
  return query;
}

/**
 * Build tier-biased search query for fact verification
 * @param {Fact} fact - Fact to verify
 * @param {string} direction - 'supporting' or 'refuting'
 * @returns {string}
 */
export function buildTierBiasedQuery(fact, direction = 'supporting') {
  const baseQuery = buildSearchQuery(fact, direction);
  const tierBias = '(site:.gov OR site:.edu OR site:.mil OR site:.int)';
  return `${baseQuery} ${tierBias}`;
}

/**
 * Build metadata-aware search queries
 * @param {Fact} fact - Fact to verify
 * @param {object|null} pageMetadata - Page metadata for context
 * @param {string} direction - 'supporting' or 'refuting'
 * @returns {string[]}
 */
export function buildMetadataQueries(fact, pageMetadata, direction = 'supporting') {
  if (!pageMetadata || typeof pageMetadata !== 'object') {
    return [];
  }
  
  const baseQuery = buildSearchQuery(fact, direction);
  const queries = [];
  
  if (pageMetadata.title) {
    const title = String(pageMetadata.title).trim().slice(0, 160);
    if (title) {
      queries.push(`"${title}" ${baseQuery}`);
    }
  }
  
  if (pageMetadata.siteName) {
    const siteName = String(pageMetadata.siteName).trim().slice(0, 80);
    if (siteName) {
      queries.push(`${baseQuery} ${siteName}`);
    }
  }
  
  if (pageMetadata.author) {
    const author = String(pageMetadata.author).trim().slice(0, 80);
    if (author) {
      queries.push(`${baseQuery} "${author}"`);
    }
  }
  
  if (pageMetadata.section) {
    const section = String(pageMetadata.section).trim().slice(0, 80);
    if (section) {
      queries.push(`${baseQuery} ${section}`);
    }
  }
  
  if (pageMetadata.canonicalUrl) {
    const domain = extractDomain(pageMetadata.canonicalUrl);
    if (domain) {
      queries.push(`${baseQuery} site:${domain}`);
    }
  }
  
  return dedupeQueries(queries, 2);
}

/**
 * Build category-term search queries
 * @param {Fact} fact - Fact to verify
 * @param {string} category - Fact category
 * @param {string} direction - 'supporting' or 'refuting'
 * @returns {string[]}
 */
export function buildCategoryQueries(fact, category, direction = 'supporting') {
  const baseQuery = buildSearchQuery(fact, direction);
  const templates = {
    LEGAL_REGULATORY: ['lawsuit', 'injunction', 'court filing', 'complaint', 'docket', 'ruling', 'regulation'],
    MEDICAL_BIOLOGICAL: ['clinical study', 'FDA label', 'safety', 'treatment', 'guideline'],
    SCIENTIFIC_TECHNICAL: ['peer-reviewed', 'technical specification', 'research paper'],
    STATISTICAL_QUANTITATIVE: ['statistics', 'report', 'dataset', 'survey'],
    HISTORICAL_EVENT: ['archives', 'primary source', 'historical record'],
    GEOPOLITICAL_SOCIAL: ['policy', 'official statement', 'government report'],
    DEFINITIONAL_ATTRIBUTE: ['definition', 'encyclopedia', 'reference'],
    ATTRIBUTION_QUOTE: ['transcript', 'press release', 'official statement'],
    CAUSAL_RELATIONAL: ['study', 'analysis', 'evidence of']
  };
  
  const terms = templates[category] || [];
  const queries = terms.map(term => `${baseQuery} ${term}`);
  return dedupeQueries(queries, 2);
}

/**
 * Build domain-biased query using tiered source preferences
 * @param {Fact} fact - Fact to verify
 * @param {string} category - Fact category
 * @param {string} direction - 'supporting' or 'refuting'
 * @returns {string}
 */
export function buildDomainBiasedQuery(fact, category, direction = 'supporting') {
  const baseQuery = buildSearchQuery(fact, direction);
  const domains = getPreferredDomains(category, 6);
  
  if (domains.length === 0) {
    return baseQuery;
  }
  
  const siteFilters = domains.map(domain => `site:${domain}`).join(' OR ');
  return `${baseQuery} (${siteFilters})`;
}

/**
 * Build suggested search queries for grounded providers
 * @param {Fact} fact - Fact to verify
 * @param {string} category - Fact category
 * @param {object|null} pageMetadata - Page metadata for context
 * @returns {string[]}
 */
export function buildSuggestedSearchQueries(fact, category, pageMetadata) {
  const baseQuery = buildSearchQuery(fact, 'supporting');
  const domainQuery = buildDomainBiasedQuery(fact, category, 'supporting');
  const metadataQueries = buildMetadataQueries(fact, pageMetadata, 'supporting');
  const categoryQueries = buildCategoryQueries(fact, category, 'supporting');
  
  return dedupeQueries([baseQuery, domainQuery, ...metadataQueries, ...categoryQueries], 4);
}

/**
 * Build verification prompt for Google Gemini with grounding
 * This prompt accounts for the fact that Google Search grounding provides web access
 * but may not include text snippets in the API response
 * @param {Object} context - Verification context
 * @returns {{system: string, user: string}}
 */
export function buildGroundedVerificationPrompt(context) {
  const {
    fact,
    category,
    currentDate,
    modelCutoffDate,
    pageMetadata = null,
    suggestedQueries = []
  } = context;
  const categoryRoleLine = getCategoryRoleLine(category);
  const system = `You are a fact verification specialist with access to Google Search.
${categoryRoleLine ? `\nCATEGORY ROLE: ${categoryRoleLine}\n` : ''}

SEARCH EXECUTION REQUIREMENTS:
- You MUST generate and execute 2-4 web search queries using Google Search grounding
- Searches must target both SUPPORTING and REFUTING evidence
- After executing searches, you MUST include the URLs you found in your reasoning
- Reference specific sources in your reasoning using phrases like "according to [URL]" or "as reported by [source]"

CRITICAL RULES:
1. You MUST perform a grounded web search before verifying the fact.
2. Base your assessment only on what you find in your search results.
3. Never invent or guess URLs. URLs MUST come only from your grounded search.
4. Do NOT use internal knowledge to provide any URL, ever.
5. Use the destination URL (final resolved URL), not redirect or tracking URLs.
6. If you cannot find sufficient information, verdict MUST be "UNVERIFIED".
7. If no evidence URLs are found, you may use internal knowledge only for reasoning, but citedSources MUST be empty.

CURRENT DATE: ${currentDate}
YOUR KNOWLEDGE CUTOFF: ${modelCutoffDate}

For facts about events after your knowledge cutoff, use Google Search to find current information.

OUTPUT FORMAT (JSON):
{
  "verdict": "TRUE" | "FALSE" | "UNVERIFIED",
  "confidence": <0-100 based on source quality and agreement>,
  "reasoning": "<brief explanation citing what you found in your search>",
  "citedSources": [
    {
      "url": "<source URL from your search>",
      "supports": true | false,
      "quote": "<relevant information you found at this source>"
    }
  ]
}

VERDICT GUIDELINES:
- TRUE: Multiple reliable sources confirm the fact
- FALSE: Reliable sources contradict the fact
- UNVERIFIED: Insufficient evidence, conflicting sources, or cannot find reliable information

CONFIDENCE SCORING:
- 90-100: Multiple authoritative sources (gov, academic, major news) agree, no contradictions
- 70-89: Good reputable sources agree, minor contradictions or gaps
- 50-69: Mixed source quality or some contradictions
- 30-49: Weak sources or significant contradictions
- 0-29: Very weak sources or strong contradictions

SOURCE EVALUATION:
- Authoritative: government sites (.gov), academic institutions (.edu), major news organizations
- Reputable: established organizations, verified experts, known publications
- General: standard websites with clear attribution
- Weak: unknown sources, no clear authority, user-generated content

SOURCE PRIORITY:
- Prefer authoritative/reputable sources first. Only use general/weak sources if higher tiers are unavailable.`;

  const user = `FACT TO VERIFY:
"${fact.originalText}"

CATEGORY: ${category}

PAGE METADATA (context only):
${formatMetadata(pageMetadata)}

${suggestedQueries.length > 0 ? `SUGGESTED SEARCH QUERIES:\n${suggestedQueries.map(query => `- ${query}`).join('\n')}\n\n` : ''}INSTRUCTIONS:
1. FIRST: Use your Google Search tool to search for evidence about this fact
2. Generate 2-4 search queries to find both supporting AND refuting evidence
3. THEN: Review what you found and provide your verdict with citations
4. If your search finds no relevant results, return UNVERIFIED with empty citedSources

You have access to Google Search. Use it now to verify this fact. Respond with valid JSON only.`;

  return { system, user };
}

/**
 * Build fallback prompt for internal-knowledge reasoning when no sources exist
 * @param {Object} context - Verification context
 * @param {Fact} context.fact - Fact to verify
 * @param {string} context.category - Fact category
 * @param {string} context.currentDate - Current date (YYYY-MM-DD)
 * @param {string} context.modelCutoffDate - Model's knowledge cutoff date
 * @returns {{system: string, user: string}}
 */
export function buildNoEvidenceFallbackPrompt(context) {
  const { fact, category, currentDate, modelCutoffDate } = context;
  const categoryRoleLine = getCategoryRoleLine(category);
  const system = `You are a fact verification specialist.
${categoryRoleLine ? `\nCATEGORY ROLE: ${categoryRoleLine}\n` : ''}

CRITICAL RULES:
1. No web sources are available. Do NOT claim you searched or found evidence.
2. Do NOT provide URLs or citations. Never invent or guess URLs.
3. You MUST return verdict "UNVERIFIED" regardless of your opinion.
4. If you have any relevant, specific knowledge, provide a brief, user-friendly explanation.
5. If your reasoning is generic, vague, or non-informative, set hasModelKnowledge to false and confidence to 0.
6. If you have no relevant knowledge, say so clearly, set hasModelKnowledge to false, and confidence to 0.

CURRENT DATE: ${currentDate}
YOUR KNOWLEDGE CUTOFF: ${modelCutoffDate}

OUTPUT FORMAT (JSON):
{
  "verdict": "UNVERIFIED",
  "confidence": <0-70 based on your knowledge; use 0 if hasModelKnowledge is false>,
  "reasoning": "<brief, non-technical explanation or uncertainty>",
  "hasModelKnowledge": <true only if you provide specific, informative reasoning; false otherwise>
}`;
  
  const user = `FACT TO VERIFY:
"${fact.originalText}"

CATEGORY: ${category}

Provide a concise, user-friendly explanation based only on your internal knowledge (if any). Respond with valid JSON only.`;
  
  return { system, user };
}

/**
 * Build simplified verification prompt for models without web search
 * @param {Object} context - Verification context
 * @returns {{system: string, user: string}}
 */
export function buildSimpleVerificationPrompt(context) {
  const {
    fact,
    category,
    currentDate,
    modelCutoffDate
  } = context;
  
  const system = `You are a fact verification specialist.

CURRENT DATE: ${currentDate}
YOUR KNOWLEDGE CUTOFF: ${modelCutoffDate}

IMPORTANT: If the fact is about events after your knowledge cutoff, you MUST respond with verdict "UNVERIFIED" and explain that you don't have access to current information.

OUTPUT FORMAT (JSON):
{
  "verdict": "TRUE" | "FALSE" | "UNVERIFIED",
  "confidence": <0-100>,
  "reasoning": "<brief explanation>",
  "needsWebSearch": <true if fact is after cutoff or requires current info>
}

VERDICT GUIDELINES:
- TRUE: Fact is consistent with your knowledge
- FALSE: Fact contradicts your knowledge
- UNVERIFIED: Fact is after your cutoff, uncertain, or requires current information`;

  const user = `FACT TO VERIFY:
"${fact.originalText}"

CATEGORY: ${category}

Verify this fact based on your knowledge. If it requires current information beyond your cutoff date, indicate that web search is needed. Respond with valid JSON only.`;

  return { system, user };
}

