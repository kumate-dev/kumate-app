import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('plugin:react/recommended', 'plugin:@typescript-eslint/recommended'),
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['tailwind.config.js', 'postcss.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-commonjs': 'off',
    },
  },
];

export default eslintConfig;
