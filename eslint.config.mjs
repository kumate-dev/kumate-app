import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import solid from 'eslint-plugin-solid/configs/typescript';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'src-tauri/**',
      // Un-ported React screens, kept only as reference. Excluded from tsconfig too.
      'src/_legacy/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      // Without this every `document`, `window`, `setTimeout` and `console` in the
      // codebase is a `no-undef` error — the previous config never declared an
      // environment, which made the rule fire ~50 times on correct code.
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // `any` is no longer waved through. There were 64 occurrences, concentrated
      // exactly where they hurt most (the generic filter path, pod detail rendering).
      // Warn rather than error so the port is not blocked, but it must trend to zero.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'warn',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  // eslint-plugin-solid catches the two mistakes that silently break reactivity:
  // destructuring props, and reading a signal outside a tracked scope.
  { files: ['**/*.tsx'], ...solid },
  prettier,
];
