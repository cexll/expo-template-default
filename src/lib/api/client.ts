import { withApiBase } from '@/config/app';

export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, string | number | boolean | null>;
  ok: boolean;
};

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function parseEnvelope<T>(response: Response) {
  try {
    return (await response.json()) as Partial<ApiEnvelope<T>> & { error?: string };
  } catch {
    throw new ApiClientError(response.ok ? 'Invalid JSON response' : 'Request failed', response.status);
  }
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  let response: Response;

  try {
    response = await fetch(withApiBase(input), init);
  } catch {
    throw new ApiClientError('Network request failed', 0);
  }

  const payload = await parseEnvelope<T>(response);

  if (!response.ok) {
    throw new ApiClientError(payload.error ?? 'Request failed', response.status);
  }

  return {
    data: payload.data as T,
    meta: payload.meta,
    ok: Boolean(payload.ok),
  };
}
