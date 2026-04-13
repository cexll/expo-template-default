import { StatusError } from 'expo-server';

import { jsonOk, parseJson, requireParam } from '@/lib/api/server';

type EchoBody = {
  message?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<EchoBody>(request);
  const message = requireParam(body.message?.trim(), 'message is required');

  if (message.length > 120) {
    throw new StatusError(422, 'message is too long');
  }

  return jsonOk({
    message,
    receivedAt: new Date().toISOString(),
  });
}
