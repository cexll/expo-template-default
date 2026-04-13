import { POST } from '@/app/api/telemetry+api';

describe('POST /api/telemetry', () => {
  it('accepts telemetry event', async () => {
    const request = new Request('http://localhost:8081/api/telemetry', {
      method: 'POST',
      body: JSON.stringify({ event: 'auth_sign_in_demo' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.accepted).toBe(true);
    expect(json.data.event).toBe('auth_sign_in_demo');
  });

  it('rejects missing event', async () => {
    const request = new Request('http://localhost:8081/api/telemetry', {
      method: 'POST',
      body: JSON.stringify({ event: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(POST(request)).rejects.toThrow('event is required');
  });

  it('rejects too long event', async () => {
    const request = new Request('http://localhost:8081/api/telemetry', {
      method: 'POST',
      body: JSON.stringify({ event: 'a'.repeat(65) }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(POST(request)).rejects.toThrow('event is too long');
  });
});
