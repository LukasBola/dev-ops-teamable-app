import tseslint from 'typescript-eslint'
import skipFormatting from 'eslint-config-prettier/flat'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', '**/*.cjs'] },
  ...tseslint.configs.recommended,
  skipFormatting,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
