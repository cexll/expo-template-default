const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function withFallback(value: string | undefined, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function currentLoopbackHostname() {
  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location?.hostname?.trim();
  if (!hostname || !LOOPBACK_HOSTS.has(hostname)) {
    return null;
  }

  return hostname;
}

export function resolveLoopbackApiBaseUrl(value: string | undefined, fallback = '') {
  const rawValue = withFallback(value, fallback).trim();
  if (!rawValue) {
    return '';
  }

  try {
    const url = new URL(rawValue);
    const browserLoopbackHost = currentLoopbackHostname();

    if (browserLoopbackHost && LOOPBACK_HOSTS.has(url.hostname) && url.hostname !== browserLoopbackHost) {
      url.hostname = browserLoopbackHost;
    }

    return trimTrailingSlash(url.toString());
  } catch {
    return trimTrailingSlash(rawValue);
  }
}

export const appConfig = {
  apiBaseUrl: resolveLoopbackApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
  appName: withFallback(process.env.EXPO_PUBLIC_APP_NAME, 'HelloWorld'),
} as const;

export function withApiBase(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (!appConfig.apiBaseUrl) {
    return path;
  }

  return new URL(path, appConfig.apiBaseUrl).toString();
}
