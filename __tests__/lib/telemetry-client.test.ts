import { trackEvent } from '@/lib/telemetry/client';

describe('trackEvent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts telemetry payload to the api route', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as unknown as Response);

    await trackEvent({
      event: 'auth_sign_in_demo',
      properties: {
        source: 'me-tab',
        success: true,
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/telemetry', {
      body: JSON.stringify({
        event: 'auth_sign_in_demo',
        properties: {
          source: 'me-tab',
          success: true,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  });

  it('swallows network failures', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('network down'));

    await expect(
      trackEvent({
        event: 'auth_sign_out',
      })
    ).resolves.toBeUndefined();
  });
});
