import { StatusError, environment, origin } from 'expo-server';

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, string | number | boolean | null>;
  ok: true;
};

export function jsonOk<T>(
  data: T,
  init?: ResponseInit & {
    meta?: Record<string, string | number | boolean | null>;
  }
) {
  return Response.json(
    {
      data,
      meta: init?.meta,
      ok: true,
    } satisfies ApiSuccess<T>,
    init
  );
}

export async function parseJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new StatusError(400, 'Invalid JSON body');
  }
}

export function requireParam(value: string | null | undefined, message: string) {
  if (!value) {
    throw new StatusError(400, message);
  }
  return value;
}

export function apiContext(request: Request) {
  return {
    env: environment() ?? 'production',
    origin: origin() ?? new URL(request.url).origin,
  };
}
