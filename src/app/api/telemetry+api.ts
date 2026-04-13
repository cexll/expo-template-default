import { StatusError } from 'expo-server';

import { jsonOk, parseJson, requireParam } from '@/lib/api/server';

type TelemetryBody = {
  event?: string;
  properties?: Record<string, string | number | boolean | null>;
};

export async function POST(request: Request) {
  const body = await parseJson<TelemetryBody>(request);
  const event = requireParam(body.event?.trim(), 'event is required');

  if (event.length > 64) {
    throw new StatusError(422, 'event is too long');
  }

  return jsonOk({
    accepted: true,
    event,
    receivedAt: new Date().toISOString(),
  });
}
