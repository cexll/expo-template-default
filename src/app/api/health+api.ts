import { apiContext, jsonOk } from '@/lib/api/server';

export function GET(request: Request) {
  const context = apiContext(request);

  return jsonOk(
    {
      service: 'expo-template-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      meta: {
        env: context.env,
        origin: context.origin,
      },
    }
  );
}
