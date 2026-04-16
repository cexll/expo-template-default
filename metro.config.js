const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// On this macOS host, Watchman has intermittently failed with
// `FSEventStreamStart failed` / `EMFILE` during Expo web QA.
// Prefer Metro's native recursive watcher so `npm run web -- --port 8082`
// stays usable without relying on the flaky Watchman path.
if (config.resolver) {
  config.resolver.useWatchman = false;
}

// expo-sqlite web support needs wasm asset handling + cross-origin isolation headers.
// See: https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
if (config.resolver?.assetExts && !config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

if (config.server) {
  const previousEnhance = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware) => {
    const enhanced = previousEnhance ? previousEnhance(middleware) : middleware;
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      return enhanced(req, res, next);
    };
  };
}

module.exports = withNativewind(config, {
  inlineVariables: false,
  globalClassNamePolyfill: false,
});
