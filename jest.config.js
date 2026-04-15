/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // The suite currently leaves open handles (likely from React Query timers in tests),
  // causing `npm test -- --runInBand` to hang after reporting passing results.
  // Force an exit so validators complete deterministically in this environment.
  forceExit: true,
  moduleNameMapper: {
    '^expo-modules-core$': '<rootDir>/node_modules/expo-modules-core',
    '^expo-modules-core/(.*)$': '<rootDir>/node_modules/expo-modules-core/$1',
    '\\.css$': '<rootDir>/__tests__/__mocks__/style-mock.js',
  },
  modulePathIgnorePatterns: ['<rootDir>/.agents/', '<rootDir>/.claude/', '<rootDir>/.codex/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/router/root-layout.test.tsx',
    '<rootDir>/__tests__/router/tab-history.test.tsx',
    '<rootDir>/__tests__/screens/chats-screen.test.tsx',
    '<rootDir>/__tests__/screens/contacts-screen.test.tsx',
    '<rootDir>/__tests__/screens/discover-screen.test.tsx',
    '<rootDir>/__tests__/screens/me-screen.test.tsx',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-router|@expo/.*|@tanstack/react-query))',
  ],
};
