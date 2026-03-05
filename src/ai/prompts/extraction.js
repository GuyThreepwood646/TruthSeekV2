/**
 * TruthSeek Fact Extraction Prompts
 * Optimized prompts for accurate, consistent fact extraction across AI providers
 */

import { CATEGORIES, VALID_CATEGORIES } from '../../config/categories.js';

const MAX_FULL_PROMPT_SENTENCES = 24;
const MAX_FULL_PROMPT_CHARACTERS = 6000;

/**
 * Build extraction prompt for AI providers
 * @param {ExtractedContent} content - Page content with sentences
 * @param {string[]} categories - Valid category names
 * @returns {{ system: string, user: string }}
 */
export function buildExtractionPrompt(content, categories = VALID_CATEGORIES) {
  // Build category descriptions
  const categoryDescriptions = categories
    .map(cat => `- ${cat}: ${CATEGORIES[cat]?.description || 'No description'}`)
    .join('\n');
  
  // System prompt with instructions and examples
  const system = `You are a fact extraction specialist. Your task is to identify verifiable factual claims from text.

RULES:
1. Extract ONLY objectively verifiable facts - claims that can be confirmed or refuted with evidence
2. Include both explicit facts (directly stated) and implicit facts (clearly implied)
3. EXCLUDE: opinions, predictions, subjective assessments, definitions without factual claims
4. EXCLUDE: article metadata (bylines, update timestamps, photo captions, share prompts)
5. If a sentence contains multiple discrete facts, output multiple fact objects
6. Split appositive or descriptive clauses into separate facts when they state distinct claims
7. Avoid redundant facts that restate the same claim in different words; keep the most complete version
8. If a sentence uses vague references (e.g., "the restrictions", "the decision", "it"),
   use the immediately preceding sentence(s) to make the subject explicit in searchableText
9. When categories are ambiguous, prefer specialized categories over DEFINITIONAL_ATTRIBUTE
   (e.g., medications, treatments, diseases, or reproductive health should be MEDICAL_BIOLOGICAL)
10. For each fact, provide:
   - originalText: the exact text from the source
   - searchableText: rephrased as a clear, search-friendly statement with explicit subject
   - category: one of the defined categories
   - sentenceId: the source sentence ID

CATEGORIES:
${categoryDescriptions}

OUTPUT FORMAT:
You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
Ensure all strings are properly escaped (use \\" for quotes inside strings).

{
  "facts": [
    {
      "originalText": "exact quote from source",
      "searchableText": "rephrased for search",
      "category": "CATEGORY_NAME",
      "sentenceId": "s-0001"
    }
  ]
}

CRITICAL: If the text contains no verifiable facts, return: {"facts": []}

EXAMPLES:

Example 1 - Multiple facts from one sentence:
Input: [s-0001] "The Eiffel Tower, completed in 1889, stands 330 meters tall."
Output:
{
  "facts": [
    {
      "originalText": "completed in 1889",
      "searchableText": "Eiffel Tower construction completed 1889",
      "category": "HISTORICAL_EVENT",
      "sentenceId": "s-0001"
    },
    {
      "originalText": "stands 330 meters tall",
      "searchableText": "Eiffel Tower height 330 meters",
      "category": "STATISTICAL_QUANTITATIVE",
      "sentenceId": "s-0001"
    }
  ]
}

Example 1b - Appositive definition in same sentence:
Input: [s-0002] "The FDA restricted access to mifepristone, a medication for abortions and miscarriage management."
Output:
{
  "facts": [
    {
      "originalText": "The FDA restricted access to mifepristone",
      "searchableText": "FDA restricted access to mifepristone",
      "category": "LEGAL_REGULATORY",
      "sentenceId": "s-0002"
    },
    {
      "originalText": "mifepristone is a medication for abortions and miscarriage management",
      "searchableText": "mifepristone is a medication for abortions and miscarriage management",
      "category": "MEDICAL_BIOLOGICAL",
      "sentenceId": "s-0002"
    }
  ]
}

Example 2 - Opinion/prediction (no facts):
Input: [s-0002] "Many experts believe AI will transform healthcare."
Output:
{
  "facts": []
}
// This is an opinion/prediction, not a verifiable fact

Example 3 - Statistical claim with attribution:
Input: [s-0003] "According to the CDC, approximately 38 million Americans have diabetes."
Output:
{
  "facts": [
    {
      "originalText": "approximately 38 million Americans have diabetes",
      "searchableText": "CDC diabetes statistics 38 million Americans",
      "category": "STATISTICAL_QUANTITATIVE",
      "sentenceId": "s-0003"
    }
  ]
}

Example 4 - Scientific fact:
Input: [s-0004] "Water boils at 100 degrees Celsius at sea level."
Output:
{
  "facts": [
    {
      "originalText": "Water boils at 100 degrees Celsius at sea level",
      "searchableText": "water boiling point 100 Celsius sea level",
      "category": "SCIENTIFIC_TECHNICAL",
      "sentenceId": "s-0004"
    }
  ]
}

Example 5 - Legal fact:
Input: [s-0005] "The First Amendment protects freedom of speech."
Output:
{
  "facts": [
    {
      "originalText": "The First Amendment protects freedom of speech",
      "searchableText": "First Amendment freedom of speech protection",
      "category": "LEGAL_REGULATORY",
      "sentenceId": "s-0005"
    }
  ]
}

IMPORTANT: Respond with valid JSON only. No additional text or explanation.`;

  // Build sentence list for user prompt
  const sentenceList = content.sentences
    .map(s => `[${s.id}] ${s.text}`)
    .join('\n\n');
  
  // User prompt with actual content
  const user = `Extract all verifiable facts from the following sentences. Respond with valid JSON only.

SENTENCES:
${sentenceList}
${content.truncated ? '\n\nNOTE: Content was truncated due to length. Extract facts from available text.' : ''}`;

  return { system, user };
}

/**
 * Build adaptive extraction prompt to balance accuracy and token use
 * @param {ExtractedContent} content - Page content
 * @param {string[]} categories - Valid category names
 * @returns {{ system: string, user: string }}
 */
export function buildAdaptiveExtractionPrompt(content, categories = VALID_CATEGORIES) {
  const sentences = Array.isArray(content?.sentences) ? content.sentences : [];
  const sentenceCount = sentences.length;
  const totalCharacters = Number.isFinite(content?.totalCharacters)
    ? content.totalCharacters
    : sentences.reduce((sum, sentence) => sum + (sentence?.text?.length || 0), 0);
  
  if (sentenceCount > MAX_FULL_PROMPT_SENTENCES || totalCharacters > MAX_FULL_PROMPT_CHARACTERS) {
    return buildSimplifiedExtractionPrompt(content, categories);
  }
  
  return buildExtractionPrompt(content, categories);
}

/**
 * Build simplified extraction prompt for token efficiency
 * (Alternative version with fewer examples for cost-sensitive scenarios)
 * @param {ExtractedContent} content - Page content
 * @param {string[]} categories - Valid categories
 * @returns {{ system: string, user: string }}
 */
export function buildSimplifiedExtractionPrompt(content, categories = VALID_CATEGORIES) {
  const categoryList = categories.join(', ');

  const system = `You are a fact extraction specialist. Extract ONLY objectively verifiable facts from text.

Rules:
- CRITICAL: If a sentence contains multiple discrete facts, output multiple fact objects
- CRITICAL: Split appositive/descriptive clauses (e.g., "X, a type of Y, ...") into separate facts when they state distinct claims
- Extract explicit and implicit facts
- Avoid redundant facts that restate the same claim in different words
- Keep the most complete/descriptive version when choosing between near-duplicates
- Exclude opinions, predictions, subjective claims
- Prefer specialized categories over DEFINITIONAL_ATTRIBUTE when ambiguity exists
- Output JSON: {"facts": [{"originalText": "...", "searchableText": "...", "category": "...", "sentenceId": "..."}]}

Example - Multiple facts in one sentence:
Input: [s-0001] "The FDA restricted mifepristone, a medication for abortions."
Output: {"facts": [
  {"originalText": "The FDA restricted mifepristone", "searchableText": "FDA restricted mifepristone", "category": "LEGAL_REGULATORY", "sentenceId": "s-0001"},
  {"originalText": "mifepristone is a medication for abortions", "searchableText": "mifepristone medication abortions", "category": "MEDICAL_BIOLOGICAL", "sentenceId": "s-0001"}
]}

Categories: ${categoryList}

Respond with valid JSON only.`;

  const sentenceList = content.sentences
    .map(s => `[${s.id}] ${s.text}`)
    .join('\n');
  
  const user = `Extract facts:\n\n${sentenceList}`;

  return { system, user };
}

/**
 * Check if JSON response appears truncated
 * @param {string} response - Response text
 * @returns {boolean} True if response appears truncated
 */
function isResponseTruncated(response) {
  const trimmed = response.trim();
  
  // Check for incomplete JSON structures
  if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
    return true;
  }
  
  // Count braces and brackets
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  
  if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
    return true;
  }
  
  // Check for unterminated strings (odd number of unescaped quotes)
  const quotes = trimmed.match(/(?<!\\)"/g) || [];
  if (quotes.length % 2 !== 0) {
    return true;
  }
  
  return false;
}

/**
 * Clean JSON response by removing markdown code blocks
 * @param {string} response - Raw response text
 * @returns {string} Cleaned JSON string
 */
export function cleanJsonResponse(response) {
  let cleaned = response.trim();
  
  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/, '');
  
  return cleaned.trim();
}

/**
 * Parse extraction response from AI
 * @param {string} response - AI response text
 * @returns {object[]} Array of facts
 */
export function parseExtractionResponse(response) {
  if (!response || typeof response !== 'string') {
    console.error('Invalid response type:', typeof response);
    return [];
  }
  
  try {
    // Clean response - remove markdown code blocks if present
    const cleanedResponse = cleanJsonResponse(response);
    const truncated = isResponseTruncated(cleanedResponse);
    
    // Try to parse as JSON
    const parsed = JSON.parse(cleanedResponse);
    
    if (!parsed.facts || !Array.isArray(parsed.facts)) {
      console.warn('Invalid extraction response format - missing facts array');
      return [];
    }
    
    // Validate and filter facts
    const validFacts = parsed.facts.filter(fact => {
      if (!fact.originalText || !fact.searchableText || !fact.category || !fact.sentenceId) {
        console.warn('Skipping invalid fact structure:', fact);
        return false;
      }
      return true;
    });
    
    if (truncated) {
      console.debug('Response looked truncated but parsed successfully');
    }
    
    console.log(`Parsed ${validFacts.length} valid facts from response`);
    return validFacts;
    
  } catch (error) {
    if (isResponseTruncated(response)) {
      console.warn('Response appears truncated - attempting recovery');
    }
    console.error('Failed to parse extraction response:', error.message);
    
    // Fallback: Try to extract and repair JSON
    try {
      // Remove markdown first
      let cleaned = cleanJsonResponse(response);
      
      // Try to find the facts array specifically
      const factsMatch = cleaned.match(/"facts"\s*:\s*\[([\s\S]*)\]/);
      if (factsMatch) {
        // Try to reconstruct valid JSON
        const factsArrayContent = factsMatch[1];
        
        // Split by objects (look for closing brace followed by comma)
        const factObjects = [];
        let depth = 0;
        let currentObj = '';
        
        for (let i = 0; i < factsArrayContent.length; i++) {
          const char = factsArrayContent[i];
          currentObj += char;
          
          if (char === '{') depth++;
          if (char === '}') {
            depth--;
            if (depth === 0 && currentObj.trim()) {
              try {
                const obj = JSON.parse(currentObj.trim().replace(/,$/, ''));
                if (obj.originalText && obj.searchableText && obj.category && obj.sentenceId) {
                  factObjects.push(obj);
                }
              } catch (e) {
                // Skip malformed object
              }
              currentObj = '';
            }
          }
        }
        
        if (factObjects.length > 0) {
          console.log(`Recovered ${factObjects.length} facts from malformed JSON`);
          return factObjects;
        }
      }
    } catch (fallbackError) {
      console.error('Fallback parsing also failed:', fallbackError.message);
    }
    
    console.warn('Could not extract any valid facts from response');
    return [];
  }
}

