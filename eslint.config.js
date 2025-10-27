import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import nPlugin from 'eslint-plugin-n';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{js,ts}'],
    
    linterOptions: {
      sourceType: "module", 
    },
    
    plugins: {
      n: nPlugin
    },

    rules: {
      "n/no-missing-import": "off",
      "n/no-path-concat": "error",
      "n/prefer-global/buffer": ["error", "always"],
      "n/prefer-global/process": ["error", "always"],
    },
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.app.json',
        sourceType: 'module',
      },
    },
    rules: {
      "no-unused-vars": "off", 
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],

      "@typescript-eslint/explicit-function-return-type": ["error", {
        "allowExpressions": true
      }],
    
      "@typescript-eslint/no-explicit-any": "warn",
  
      "@typescript-eslint/no-var-requires": "error",

      "@typescript-eslint/require-await": "error",
    }
  },

  eslintConfigPrettier
);