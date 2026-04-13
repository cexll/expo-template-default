function withFallback(value: string | undefined, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export const appConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '',
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
