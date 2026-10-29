// ESLint flat config for the Mirage theme sources (src/ → bundled into Mirage/theme.js).
// CommonJS on purpose: the repo root is not "type": "module" (tools/ uses require).
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "Mirage/theme.js", "overlay/**", "tools/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        Spicetify: "readonly",
      },
    },
    rules: {
      // Themes poke at a DOM that changes every Spotify release – swallowing
      // errors in try/catch is intentional, empty blocks elsewhere are not.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-cond-assign": ["error", "except-parens"],
    },
  },
];
