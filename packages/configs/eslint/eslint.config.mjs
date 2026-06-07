import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import switchCase from 'eslint-plugin-switch-case';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const plugins = {
  '@stylistic': stylistic,
  js,
  perfectionist,
  'switch-case': switchCase,
  'unused-imports': unusedImports,
};

const rules = {
  '@stylistic/jsx-curly-brace-presence': ['error', { children: 'never', propElementValues: 'always', props: 'never' }],
  '@typescript-eslint/consistent-type-imports': 'error',
  'arrow-body-style': ['error', 'always'],
  curly: 'error',
  'func-style': ['error', 'declaration', { allowTypeAnnotation: true }],
  'max-len': 'off',
  'no-undef': 'off',
  'no-useless-rename': 'error',
  'object-shorthand': 'error',
  'switch-case/newline-between-switch-case': ['error', 'always', { fallthrough: 'never' }],
  'switch-case/no-case-curly': 'off',

  'unused-imports/no-unused-imports': 'error',

  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      caughtErrors: 'none',
      varsIgnorePattern: '^_',
    },
  ],

  'no-console': [
    'warn',
    {
      allow: ['info', 'warn', 'error'],
    },
  ],

  'padding-line-between-statements': [
    'error',
    { blankLine: 'always', next: 'return', prev: '*' },
    { blankLine: 'always', next: 'block-like', prev: '*' },
    { blankLine: 'always', next: 'block', prev: '*' },
    { blankLine: 'always', next: '*', prev: 'block-like' },
    { blankLine: 'always', next: '*', prev: 'block' },
  ],

  'perfectionist/sort-exports': [
    'error',
    {
      ignoreCase: true,
      order: 'asc',
      type: 'alphabetical',
    },
  ],

  'perfectionist/sort-imports': [
    'error',
    {
      ignoreCase: true,
      newlinesBetween: 1,
      order: 'asc',
      type: 'alphabetical',
      groups: [
        'builtin',
        { newlinesBetween: 1 },
        'external',
        { newlinesBetween: 1 },
        'internal',
        { newlinesBetween: 1 },
        'parent',
        { newlinesBetween: 1 },
        ['index', 'sibling'],
      ],
    },
  ],

  'perfectionist/sort-jsx-props': [
    'error',
    {
      type: 'line-length',
    },
  ],

  'perfectionist/sort-named-imports': [
    'error',
    {
      type: 'line-length',
    },
  ],

  'perfectionist/sort-object-types': [
    'error',
    {
      groups: ['unknown', 'method', 'multiline-member'],
    },
  ],

  'perfectionist/sort-objects': [
    'error',
    {
      groups: ['unknown', 'method', 'multiline-member'],
    },
  ],
};

export default defineConfig([
  globalIgnores(['.turbo/**/*', 'dist/**/*', '.next/**/*', '.open-next/**/*', '.wrangler/**/*', 'src/generated/**/*']),
  {
    extends: [js.configs.recommended, tseslint.configs.recommended, switchCase.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    plugins,
    rules,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    extends: [js.configs.recommended, tseslint.configs.recommended, switchCase.configs.recommended],
    files: ['**/*.{js,mjs,cjs}'],
    plugins,
    rules,
  },
]);
