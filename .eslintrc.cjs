/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2020: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'jsdoc'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      files: [
        'packages/bmad-speckit/src/**/*.js',
        'packages/scoring/**/*.ts',
        'scripts/**/*.ts',
      ],
      excludedFiles: ['**/__tests__/**', '**/*.test.js', '**/*.test.ts'],
      rules: {
        'jsdoc/require-description': 'error',
        'jsdoc/require-param': 'error',
        'jsdoc/require-param-description': 'warn',
        'jsdoc/require-param-type': 'error',
        'jsdoc/require-returns': 'error',
        'jsdoc/require-returns-description': 'warn',
        'jsdoc/require-returns-type': 'error',
      },
    },
    {
      files: ['**/*.test.ts', '**/__tests__/**/*.ts', '**/*.test.js'],
      rules: {
        'jsdoc/require-description': 'off',
        'jsdoc/require-param': 'off',
        'jsdoc/require-param-description': 'off',
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/require-returns-description': 'off',
        'jsdoc/require-returns-type': 'off',
      },
    },
    {
      files: ['packages/bmad-speckit/**/*.js'],
      parserOptions: { ecmaVersion: 2020, sourceType: 'script' },
      env: { node: true, es2020: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^(_|e|err|_err)$',
          },
        ],
        'no-empty': ['error', { allowEmptyCatch: true }],
      },
    },
    {
      files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '_bmad/',
    '_bmad-output/',
    'scripts/init-to-root.js', // CommonJS entry
    '*.config.ts',
  ],
};
