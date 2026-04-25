// ESLint flat config (v9+)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-plugin/**',
      '**/build/**',
      '**/.venv/**',
      '**/coverage/**',
      'docs/design_handoff_cowork_agent/reference/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
