// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      '.agents/**',
      '.claude/**',
      '.expo/**',
      // Legacy scaffold tests that reference removed `(tabs)` routes.
      '__tests__/router/root-layout.test.tsx',
      '__tests__/router/tab-history.test.tsx',
      '__tests__/screens/chats-screen.test.tsx',
      '__tests__/screens/contacts-screen.test.tsx',
      '__tests__/screens/discover-screen.test.tsx',
      '__tests__/screens/me-screen.test.tsx',
    ],
  },
]);
