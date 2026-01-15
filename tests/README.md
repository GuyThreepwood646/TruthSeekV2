# TruthSeek Tests

This directory contains the test suite for TruthSeek.

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Structure

### `extraction.test.js`
Tests for the fact extraction pipeline:
- HTML content extraction
- Sentence segmentation
- XPath generation
- Fact deduplication
- Fact validation
- Category validation
- Integration tests

### `setup.js`
Global test setup:
- Chrome API mocks
- Console mocks
- Fetch mocks
- Intl.Segmenter polyfill

## Coverage Goals

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Writing New Tests

1. Create a new file in `tests/` with `.test.js` extension
2. Import the modules you want to test
3. Use Jest's `describe`, `test`, and `expect` functions
4. Mock Chrome APIs as needed using `chrome.storage.local.get.mockResolvedValue()`

Example:

```javascript
import { myFunction } from '../src/my-module.js';

describe('My Module', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });
});
```

## Mocking Chrome APIs

Chrome APIs are mocked globally in `setup.js`. To customize behavior for a specific test:

```javascript
chrome.storage.local.get.mockResolvedValue({
  agents: [{ id: 'agent1', qualityRank: 90 }]
});
```

## Testing Async Functions

Use `async/await` in your tests:

```javascript
test('should handle async operations', async () => {
  const result = await myAsyncFunction();
  expect(result).toBeDefined();
});
```

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Descriptive names**: Use clear test descriptions
4. **Mock external dependencies**: Don't make real API calls
5. **Test edge cases**: Include error scenarios
6. **Clean up**: Reset mocks between tests (done automatically)

