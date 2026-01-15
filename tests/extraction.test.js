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

describe('HTML Content Extraction', () => {
  
  // AC8.1.1: Test extraction from sample HTML
  test('should extract visible text from HTML', () => {
    // Setup DOM
    document.body.innerHTML = `
      <div>
        <p>The Eiffel Tower was completed in 1889.</p>
        <p>It stands 330 meters tall.</p>
        <script>console.log('should be ignored');</script>
        <style>.hidden { display: none; }</style>
      </div>
    `;
    
    const result = extractPageContent();
    
    expect(result.sentences).toBeDefined();
    expect(result.sentences.length).toBeGreaterThan(0);
    
    // Check that text was extracted
    const allText = result.sentences.map(s => s.text).join(' ');
    expect(allText).toContain('Eiffel Tower');
    expect(allText).toContain('1889');
    expect(allText).toContain('330 meters');
    
    // Check that scripts/styles were excluded
    expect(allText).not.toContain('should be ignored');
    expect(allText).not.toContain('.hidden');
  });
  
  // AC8.1.2: Test sentence segmentation
  test('should segment text into sentences', () => {
    document.body.innerHTML = `
      <p>First sentence. Second sentence. Third sentence.</p>
    `;
    
    const result = extractPageContent();
    
    expect(result.sentences.length).toBeGreaterThanOrEqual(3);
    
    // Check sentence IDs are sequential
    expect(result.sentences[0].id).toMatch(/^s-\d{4}$/);
    expect(result.sentences[1].id).toMatch(/^s-\d{4}$/);
  });
  
  // AC8.1.3: Test XPath generation
  test('should generate XPath for each sentence', () => {
    document.body.innerHTML = `
      <div id="content">
        <p>Test sentence.</p>
      </div>
    `;
    
    const result = extractPageContent();
    
    expect(result.sentences.length).toBeGreaterThan(0);
    expect(result.sentences[0].xpath).toBeDefined();
    expect(result.sentences[0].xpath).toContain('//');
  });
  
  // AC8.1.4: Test exclusion of navigation/footer
  test('should exclude navigation and footer elements', () => {
    document.body.innerHTML = `
      <nav>Navigation link</nav>
      <main>Main content here.</main>
      <footer>Footer content</footer>
    `;
    
    const result = extractPageContent();
    
    const allText = result.sentences.map(s => s.text).join(' ');
    expect(allText).toContain('Main content');
    expect(allText).not.toContain('Navigation link');
    expect(allText).not.toContain('Footer content');
  });
  
  // AC8.1.5: Test size limit handling
  test('should truncate content exceeding size limit', () => {
    // Create large content
    const largeText = 'A'.repeat(150000); // 150KB
    document.body.innerHTML = `<p>${largeText}</p>`;
    
    const result = extractPageContent();
    
    expect(result.truncated).toBe(true);
    expect(result.totalCharacters).toBeLessThanOrEqual(100 * 1024);
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
            originalText: 'Tower is 330 meters tall',
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
            originalText: 'Tower stands 330m high',
            searchableText: 'Eiffel Tower stands 330m high',
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
            searchableText: 'Eiffel Tower 330m',
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
    // Setup DOM
    document.body.innerHTML = `
      <article>
        <p>The Eiffel Tower was completed in 1889.</p>
        <p>It stands 330 meters tall.</p>
      </article>
    `;
    
    // Extract content
    const content = extractPageContent();
    expect(content.sentences.length).toBeGreaterThan(0);
    
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
            sentenceId: content.sentences[0].id
          },
          {
            originalText: 'stands 330 meters tall',
            searchableText: 'Eiffel Tower height 330 meters',
            category: 'STATISTICAL_QUANTITATIVE',
            sentenceId: content.sentences[1].id
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

