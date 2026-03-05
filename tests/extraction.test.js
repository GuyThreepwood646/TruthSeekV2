/**
 * TruthSeek Fact Extraction Pipeline Tests
 * Tests for content extraction, deduplication, and validation
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Import modules to test
import { extractPageContent } from '../src/content/extractor.js';
import { deduplicate, getDeduplicationStats } from '../src/background/deduplication.js';
import { validateFacts, validateCategoryAssignment, getValidationStats } from '../src/background/fact-validator.js';
import { VALID_CATEGORIES } from '../src/config/categories.js';

let extractionRunId = 0;

async function runExtraction() {
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    configurable: true
  });
  extractionRunId += 1;
  window.history.pushState({}, '', `/test-${extractionRunId}`);
  jest.useFakeTimers();
  const extractionPromise = extractPageContent();
  await Promise.resolve();
  jest.advanceTimersByTime(2000);
  const result = await extractionPromise;
  jest.useRealTimers();
  return result;
}

function buildLongText(baseSentence, repeatCount) {
  return Array.from({ length: repeatCount }, () => baseSentence).join(' ');
}

function buildUniqueSentences(baseSentence, count) {
  const sentences = [];
  for (let i = 0; i < count; i++) {
    sentences.push(`${baseSentence} (${i + 1}).`);
  }
  return sentences.join(' ');
}

function buildParagraphs(baseSentence, count) {
  const paragraphs = [];
  for (let i = 0; i < count; i++) {
    paragraphs.push(`<p>${baseSentence} ${i + 1}.</p>`);
  }
  return paragraphs.join('');
}

describe('HTML Content Extraction', () => {
  
  // AC8.1.1: Test extraction from sample HTML
  test('should extract visible text from HTML', async () => {
    const firstParagraph = 'The Eiffel Tower was completed in 1889 and stands 330 meters tall in Paris France.';
    const secondParagraph = 'The landmark attracts visitors from around the world and remains a cultural icon.';
    // Setup DOM
    document.body.innerHTML = `
      <div>
        <p>${firstParagraph}</p>
        <p>${secondParagraph}</p>
        <script>console.log('should be ignored');</script>
        <style>.hidden { display: none; }</style>
      </div>
    `;
    
    const result = await runExtraction();
    
    expect(result.sentences).toBeDefined();
    expect(result.sentences.length).toBeGreaterThan(0);
    
    // Check that text was extracted
    const allText = result.sentences.map(s => s.text).join(' ');
    expect(allText).toContain('Eiffel Tower');
    expect(allText).toContain('330 meters');
    
    // Check that scripts/styles were excluded
    expect(allText).not.toContain('should be ignored');
    expect(allText).not.toContain('.hidden');
  });
  
  // AC8.1.2: Test sentence segmentation
  test('should segment text into sentences', async () => {
    const firstSentence = 'The Eiffel Tower stands 330 meters tall and is located in Paris France.';
    const secondSentence = 'The structure was completed in 1889 and remains a key landmark in the city.';
    const thirdSentence = 'The monument attracts millions of visitors each year from around the world.';
    document.body.innerHTML = `
      <p>${firstSentence} ${secondSentence} ${thirdSentence}</p>
    `;
    
    const result = await runExtraction();
    
    expect(result.sentences.length).toBeGreaterThanOrEqual(3);
    
    // Check sentence IDs are sequential
    expect(result.sentences[0].id).toMatch(/^s-\d{4}$/);
    expect(result.sentences[1].id).toMatch(/^s-\d{4}$/);
  });
  
  // AC8.1.3: Test XPath generation
  test('should generate XPath for each sentence', async () => {
    const longText = buildLongText(
      'The Eiffel Tower stands 330 meters tall and is located in Paris France.',
      4
    );
    document.body.innerHTML = `
      <div id="content">
        <p>${longText}</p>
      </div>
    `;
    
    const result = await runExtraction();
    
    expect(result.sentences.length).toBeGreaterThan(0);
    expect(result.sentences[0].xpath).toBeDefined();
    expect(result.sentences[0].xpath).toContain('//');
  });
  
  // AC8.1.4: Test exclusion of navigation/footer
  test('should exclude navigation and footer elements', async () => {
    const mainParagraph = buildLongText(
      'In 1889 the Eiffel Tower was completed and remains a landmark in Paris France.',
      5
    );
    const secondaryParagraph = buildLongText(
      'The structure attracts millions of visitors each year and is 330 meters tall.',
      5
    );
    document.body.innerHTML = `
      <nav>Navigation link</nav>
      <article class="article-body">
        <p>${mainParagraph}</p>
        <p>${secondaryParagraph}</p>
      </article>
      <footer>Footer content</footer>
    `;
    
    const result = await runExtraction();
    
    const allText = result.sentences.map(s => s.text).join(' ');
    expect(allText).toContain('Eiffel Tower');
    expect(allText).not.toContain('Navigation link');
    expect(allText).not.toContain('Footer content');
  });
  
  // AC8.1.5: Test size limit handling
  test('should handle large content without failing', async () => {
    const paragraphs = buildParagraphs(
      'The Eiffel Tower stands 330 meters tall and is located in Paris France',
      300
    );
    document.body.innerHTML = `<article class="article-body">${paragraphs}</article>`;
    
    const result = await runExtraction();
    
    expect(result.sentences.length).toBeGreaterThan(0);
    expect(result.batchCount).toBeGreaterThan(0);
    expect(result.totalCharacters).toBeGreaterThan(0);
  });
});

describe('Fact Deduplication', () => {
  
  // AC8.1.6: Test exact duplicate removal
  test('should remove exact duplicates', async () => {
    const rawResults = [
      {
        agentId: 'agent1',
        success: true,
        facts: [
          {
            originalText: 'The Eiffel Tower is 330 meters tall',
            searchableText: 'Eiffel Tower height 330 meters',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: 's-0001'
          }
        ]
      },
      {
        agentId: 'agent2',
        success: true,
        facts: [
          {
            originalText: 'The Eiffel Tower is 330 meters tall',
            searchableText: 'Eiffel Tower height 330 meters',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: 's-0001'
          }
        ]
      }
    ];
    
    // Mock agent ranks
    chrome.storage.local.get.mockResolvedValue({
      agents: [
        { id: 'agent1', qualityRank: 90 },
        { id: 'agent2', qualityRank: 85 }
      ]
    });
    
    const deduplicated = await deduplicate(rawResults);
    
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].provenance).toContain('agent1');
    expect(deduplicated[0].provenance).toContain('agent2');
  });
  
  // AC8.1.7: Test semantic equivalence detection
  test('should detect semantic equivalents', async () => {
    const rawResults = [
      {
        agentId: 'agent1',
        success: true,
        facts: [
          {
            originalText: 'Eiffel Tower height 330 meters tall monument in Paris France',
            searchableText: 'Eiffel Tower height 330 meters tall monument in Paris France',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: 's-0001'
          }
        ]
      },
      {
        agentId: 'agent2',
        success: true,
        facts: [
          {
            originalText: 'Eiffel Tower height 330 meters tall monument in Paris France iconic',
            searchableText: 'Eiffel Tower height 330 meters tall monument in Paris France iconic',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: 's-0001'
          }
        ]
      }
    ];
    
    chrome.storage.local.get.mockResolvedValue({
      agents: [
        { id: 'agent1', qualityRank: 90 },
        { id: 'agent2', qualityRank: 85 }
      ]
    });
    
    const deduplicated = await deduplicate(rawResults);
    
    // Should merge semantically similar facts
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].provenance.length).toBe(2);
  });
  
  // AC8.1.8: Test model quality tiebreaking
  test('should use model quality for tiebreaking', async () => {
    const rawResults = [
      {
        agentId: 'low-quality',
        success: true,
        facts: [
          {
            originalText: 'Short version',
            searchableText: 'Eiffel Tower height 330 meters',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: 's-0001'
          }
        ]
      },
      {
        agentId: 'high-quality',
        success: true,
        facts: [
          {
            originalText: 'Detailed version with more context',
            searchableText: 'Eiffel Tower height 330 meters',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: 's-0001'
          }
        ]
      }
    ];
    
    chrome.storage.local.get.mockResolvedValue({
      agents: [
        { id: 'low-quality', qualityRank: 70 },
        { id: 'high-quality', qualityRank: 95 }
      ]
    });
    
    const deduplicated = await deduplicate(rawResults);
    
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].agentId).toBe('high-quality');
    expect(deduplicated[0].originalText).toContain('Detailed version');
  });
  
  // AC8.1.9: Test deduplication statistics
  test('should generate accurate statistics', async () => {
    const rawResults = [
      {
        agentId: 'agent1',
        success: true,
        facts: [
          { originalText: 'Fact 1', searchableText: 'fact 1', category: 'HISTORICAL_EVENT', sentenceId: 's-0001' },
          { originalText: 'Fact 2', searchableText: 'fact 2', category: 'HISTORICAL_EVENT', sentenceId: 's-0002' }
        ]
      },
      {
        agentId: 'agent2',
        success: true,
        facts: [
          { originalText: 'Fact 1', searchableText: 'fact 1', category: 'HISTORICAL_EVENT', sentenceId: 's-0001' }
        ]
      }
    ];
    
    chrome.storage.local.get.mockResolvedValue({
      agents: [
        { id: 'agent1', qualityRank: 90 },
        { id: 'agent2', qualityRank: 85 }
      ]
    });
    
    const deduplicated = await deduplicate(rawResults);
    const stats = getDeduplicationStats(rawResults, deduplicated);
    
    expect(stats.totalFacts).toBe(3);
    expect(stats.uniqueFacts).toBe(2);
    expect(stats.duplicatesRemoved).toBe(1);
  });
});

describe('Fact Validation', () => {
  
  // AC8.1.10: Test category validation
  test('should reject invalid categories', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'Test fact',
        searchableText: 'test fact',
        category: 'INVALID_CATEGORY',
        sentenceId: 's-0001',
        agentId: 'agent1'
      }
    ];
    
    const result = validateFacts(facts);
    
    expect(result.validFacts.length).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errors[0]).toContain('Invalid category');
  });
  
  // AC8.1.11: Test required fields validation
  test('should reject facts with missing required fields', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'Test fact',
        // Missing searchableText
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0001',
        agentId: 'agent1'
      }
    ];
    
    const result = validateFacts(facts);
    
    expect(result.validFacts.length).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errors[0]).toContain('Missing required field: searchableText');
  });
  
  // AC8.1.12: Test text length constraints
  test('should reject facts that are too short or too long', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'Short',
        searchableText: 'short',
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0001',
        agentId: 'agent1'
      },
      {
        id: 'f-0002',
        originalText: 'A'.repeat(600),
        searchableText: 'B'.repeat(600),
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0002',
        agentId: 'agent1'
      }
    ];
    
    const result = validateFacts(facts);
    
    expect(result.validFacts.length).toBe(0);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].errors[0]).toContain('too short');
    expect(result.errors[1].errors[0]).toContain('too long');
  });
  
  // AC8.1.13: Test sentenceId format validation
  test('should validate sentenceId format', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'Valid fact with proper length',
        searchableText: 'valid fact proper length',
        category: 'HISTORICAL_EVENT',
        sentenceId: 'invalid-format',
        agentId: 'agent1'
      }
    ];
    
    const result = validateFacts(facts);
    
    expect(result.validFacts.length).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].errors[0]).toContain('Invalid sentenceId format');
  });
  
  // AC8.1.14: Test XSS detection
  test('should detect and reject XSS attempts', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'Click here <script>alert("xss")</script>',
        searchableText: 'click here alert xss',
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0001',
        agentId: 'agent1'
      },
      {
        id: 'f-0002',
        originalText: 'Valid fact with proper length here',
        searchableText: 'javascript:void(0)',
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0002',
        agentId: 'agent1'
      }
    ];
    
    const result = validateFacts(facts);
    
    expect(result.validFacts.length).toBe(0);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].errors[0]).toContain('XSS');
    expect(result.errors[1].errors[0]).toContain('XSS');
  });
  
  // AC8.1.15: Test valid fact acceptance
  test('should accept valid facts', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'The Eiffel Tower was completed in 1889',
        searchableText: 'Eiffel Tower construction completed 1889',
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0001',
        agentId: 'agent1'
      }
    ];
    
    const result = validateFacts(facts);
    
    expect(result.validFacts.length).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(result.validFacts[0].originalText).toContain('Eiffel Tower');
  });
  
  // AC8.1.16: Test category assignment validation
  test('should validate category assignment quality', () => {
    const historicalFact = {
      originalText: 'World War II ended in 1945',
      searchableText: 'World War II ended 1945',
      category: 'HISTORICAL_EVENT',
      sentenceId: 's-0001'
    };
    
    const result = validateCategoryAssignment(historicalFact);
    
    expect(result.isValid).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });
  
  // AC8.1.17: Test category mismatch detection
  test('should detect category mismatches', () => {
    const fact = {
      originalText: 'World War II ended in 1945',
      searchableText: 'World War II ended 1945',
      category: 'MEDICAL_BIOLOGICAL', // Wrong category
      sentenceId: 's-0001'
    };
    
    const result = validateCategoryAssignment(fact);
    
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion).not.toBe('MEDICAL_BIOLOGICAL');
  });
  
  test('should prefer specialized category over definitional phrasing', () => {
    const fact = {
      originalText: 'mifepristone is a medication for abortions and miscarriage management',
      searchableText: 'mifepristone is a medication for abortions and miscarriage management',
      category: 'DEFINITIONAL_ATTRIBUTE',
      sentenceId: 's-0001'
    };
    
    const result = validateCategoryAssignment(fact);
    
    expect(result.suggestion).toBe('MEDICAL_BIOLOGICAL');
    expect(result.suggestionScore).toBeGreaterThan(result.confidence);
  });
  
  // AC8.1.18: Test validation statistics
  test('should generate validation statistics', () => {
    const facts = [
      {
        id: 'f-0001',
        originalText: 'Valid fact with proper length',
        searchableText: 'valid fact proper length',
        category: 'HISTORICAL_EVENT',
        sentenceId: 's-0001',
        agentId: 'agent1'
      },
      {
        id: 'f-0002',
        originalText: 'Short',
        searchableText: 'short',
        category: 'INVALID',
        sentenceId: 'bad-format',
        agentId: 'agent1'
      }
    ];
    
    const validationResult = validateFacts(facts);
    const stats = getValidationStats(validationResult);
    
    expect(stats.totalProcessed).toBe(2);
    expect(stats.validCount).toBe(1);
    expect(stats.errorCount).toBe(1);
    expect(stats.validationRate).toBeDefined();
  });
});

describe('Integration Tests', () => {
  
  // AC8.1.19: Test full extraction pipeline
  test('should process facts through full pipeline', async () => {
    const longText = buildLongText(
      'The Eiffel Tower stands 330 meters tall and is located in Paris France.',
      4
    );
    // Setup DOM
    document.body.innerHTML = `
      <article>
        <p>${longText}</p>
        <p>The Eiffel Tower was completed in 1889 and remains a landmark in Paris France.</p>
      </article>
    `;
    
    // Extract content
    const content = await runExtraction();
    expect(content.sentences.length).toBeGreaterThan(0);
    
    const firstSentenceId = content.sentences[0]?.id || 's-0001';
    const secondSentenceId = content.sentences[1]?.id || firstSentenceId;
    
    // Simulate extraction results
    const rawResults = [
      {
        agentId: 'agent1',
        success: true,
        facts: [
          {
            originalText: 'completed in 1889',
            searchableText: 'Eiffel Tower construction completed 1889',
            category: 'HISTORICAL_EVENT',
            sentenceId: firstSentenceId
          },
          {
            originalText: 'stands 330 meters tall',
            searchableText: 'Eiffel Tower height 330 meters',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: secondSentenceId
          }
        ]
      }
    ];
    
    chrome.storage.local.get.mockResolvedValue({
      agents: [{ id: 'agent1', qualityRank: 90 }]
    });
    
    // Deduplicate
    const deduplicated = await deduplicate(rawResults);
    expect(deduplicated.length).toBe(2);
    
    // Validate
    const validated = validateFacts(deduplicated);
    expect(validated.validFacts.length).toBe(2);
    expect(validated.errors.length).toBe(0);
  });
  
  // AC8.1.20: Test error handling and recovery
  test('should handle partial failures gracefully', async () => {
    const rawResults = [
      {
        agentId: 'agent1',
        success: true,
        facts: [
          {
            originalText: 'Valid fact with proper length',
            searchableText: 'valid fact proper length',
            category: 'HISTORICAL_EVENT',
            sentenceId: 's-0001'
          },
          {
            originalText: 'Bad',
            searchableText: 'bad',
            category: 'INVALID',
            sentenceId: 'wrong'
          }
        ]
      }
    ];
    
    chrome.storage.local.get.mockResolvedValue({
      agents: [{ id: 'agent1', qualityRank: 90 }]
    });
    
    const deduplicated = await deduplicate(rawResults);
    const validated = validateFacts(deduplicated);
    
    // Should continue with valid facts
    expect(validated.validFacts.length).toBe(1);
    expect(validated.errors.length).toBe(1);
  });
});

