import { POST } from '@/app/api/echo+api';

describe('POST /api/echo', () => {
  it('echoes message', async () => {
    const request = new Request('http://localhost:8081/api/echo', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.message).toBe('hello');
  });

  it('rejects empty message', async () => {
    const request = new Request('http://localhost:8081/api/echo', {
      method: 'POST',
      body: JSON.stringify({ message: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(POST(request)).rejects.toThrow('message is required');
  });

  it('rejects invalid json', async () => {
    const request = new Request('http://localhost:8081/api/echo', {
      method: 'POST',
      body: '{"message"',
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(POST(request)).rejects.toThrow('Invalid JSON body');
  });

  it('rejects too long message', async () => {
    const request = new Request('http://localhost:8081/api/echo', {
      method: 'POST',
      body: JSON.stringify({ message: 'a'.repeat(121) }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(POST(request)).rejects.toThrow('message is too long');
  });
});
