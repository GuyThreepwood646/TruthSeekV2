/**
 * TruthSeek Verification Prompts
 * Prompts that enforce grounding in live web search results
 */

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
  
  const system = `You are a fact verification specialist. Your ONLY job is to verify facts using the web search results provided.

CRITICAL RULES:
1. Base your assessment ONLY on the provided sources from web search
2. Do NOT use your training data or knowledge
3. You MUST cite specific sources (by URL) for every claim you make
4. If sources are insufficient or conflicting, verdict MUST be "UNVERIFIED"

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
- Tier 4: Unverified (unknown sources, no clear authority)`;

  const user = `FACT TO VERIFY:
"${fact.originalText}"

CATEGORY: ${category}

PAGE METADATA (context only):
${formatMetadata(pageMetadata)}

SUPPORTING SOURCES FOUND:
${formatSources(supportingSources)}

REFUTING SOURCES FOUND:
${formatSources(refutingSources)}

Based ONLY on these sources, verify the fact. Respond with valid JSON only.`;

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
    return "No sources found.";
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
    pageMetadata = null
  } = context;
  
  const system = `You are a fact verification specialist with access to Google Search.

CRITICAL RULES:
1. You have access to Google Search and can look up current information
2. Search for and review web sources to verify the fact
3. Base your assessment on what you find in your search results
4. Cite specific sources (by URL and content) for your verdict
5. If you cannot find sufficient information, verdict MUST be "UNVERIFIED"

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
- Weak: unknown sources, no clear authority, user-generated content`;

  const user = `FACT TO VERIFY:
"${fact.originalText}"

CATEGORY: ${category}

PAGE METADATA (context only):
${formatMetadata(pageMetadata)}

Use Google Search to find reliable sources that either support or refute this fact. Review the sources you find and provide your verdict with citations. Respond with valid JSON only.`;

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

