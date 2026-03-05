/**
 * Jest setup file
 * Runs before each test file
 */

import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

globalThis.jest = jest;
globalThis.TextEncoder = globalThis.TextEncoder || TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder || TextDecoder;

// Mock Chrome APIs globally
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`)
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  identity: {
    getAuthToken: jest.fn(),
    removeCachedAuthToken: jest.fn(),
    launchWebAuthFlow: jest.fn()
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Intl.Segmenter for older Node versions
if (typeof Intl.Segmenter === 'undefined') {
  global.Intl.Segmenter = class Segmenter {
    constructor(locale, options) {
      this.locale = locale;
      this.options = options;
    }
    
    segment(text) {
      // Simple fallback: split by sentence-ending punctuation
      const sentences = text.split(/(?<=[.!?])\s+/);
      return sentences.map(segment => ({ segment }));
    }
  };
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

