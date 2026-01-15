/**
 * Rollup configuration for bundling TruthSeek content scripts
 * Content scripts don't support ES modules, so we bundle them
 */

export default [
  {
    input: 'src/content/content.js',
    output: {
      file: 'dist/content.js',
      format: 'iife',
      name: 'TruthSeekContent'
    }
  }
];

