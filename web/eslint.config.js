import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'migration/snapshot', 'migration/runs', 'migration/.build'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      // Book 08 §3/§14: Supabase is reached only through repositories (src/features/*/data, src/lib).
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@supabase/supabase-js'], message: 'Import the client from @/lib/supabase inside a repository only.' }],
      }],
    },
  },
  {
    files: ['src/lib/supabase/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['migration/**/*.mjs', '*.config.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
);
