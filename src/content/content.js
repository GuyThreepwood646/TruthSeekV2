/**
 * TruthSeek Content Script
 * Entry point for content script injected into web pages
 */

// Import messaging system
import { initialize as initializeMessaging, registerHandler } from './messaging.js';
import { MessageType } from '../shared/message-types.js';

// Import modules
import { extractPageContent } from './extractor.js';
import { 
  initializeHighlighter, 
  highlightSentence, 
  updateHighlight, 
  clearAllHighlights
} from './highlighter.js';
import {
  initializeProgressPopup,
  showProgress,
  updateProgress,
  hideProgress,
  showResults,
  closeResults
} from './progress-popup.js';
import {
  initializeModal
} from './modal.js';

// Initialize messaging, highlighter, progress popup, and modal
initializeMessaging();
initializeHighlighter();
initializeProgressPopup();
initializeModal();

// Note: PING is handled directly in messaging.js before validation

// Register content extraction handler
registerHandler(MessageType.GET_PAGE_CONTENT, async (payload) => {
  console.log('Extracting page content...');
  const content = await extractPageContent();
  console.log(`Extracted ${content.sentences.length} sentences`);
  return content;
});

registerHandler(MessageType.HIGHLIGHT_SENTENCE, async (payload) => {
  const { sentenceId, xpath, status, text } = payload;
  
  if (!sentenceId || !xpath) {
    console.error('Invalid HIGHLIGHT_SENTENCE payload:', payload);
    return { success: false, error: 'Missing sentenceId or xpath' };
  }
  
  highlightSentence(sentenceId, xpath, status || 'processing', text);
  return { success: true };
});

registerHandler(MessageType.UPDATE_HIGHLIGHT_COLOR, async (payload) => {
  const { sentenceId, status } = payload;
  
  if (!sentenceId || !status) {
    console.error('Invalid UPDATE_HIGHLIGHT_COLOR payload:', payload);
    return { success: false, error: 'Missing sentenceId or status' };
  }
  
  updateHighlight(sentenceId, status);
  return { success: true };
});

registerHandler(MessageType.SHOW_PROGRESS, async (payload) => {
  showProgress(payload);
  return { success: true };
});

registerHandler(MessageType.UPDATE_PROGRESS, async (payload) => {
  updateProgress(payload);
  return { success: true };
});

registerHandler(MessageType.SHOW_RESULTS, async (payload) => {
  const { summary } = payload;
  showResults(summary);
  return { success: true };
});

registerHandler(MessageType.CLOSE_RESULTS, async (payload) => {
  closeResults();
  return { success: true };
});

// Handle CANCEL_FACT_CHECK message
registerHandler(MessageType.CANCEL_FACT_CHECK, async (payload) => {
  console.log('Fact-check cancelled, clearing highlights and hiding progress');
  clearAllHighlights();
  hideProgress();
  return { success: true };
});

console.log('TruthSeek content script initialized on:', window.location.href);

