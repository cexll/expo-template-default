jest.mock('expo-server', () => {
  const actual = jest.requireActual('expo-server');
  return {
    ...actual,
    environment: () => 'test',
    origin: () => 'http://localhost:8081',
  };
});

import { GET } from '@/app/api/health+api';

describe('GET /api/health', () => {
  it('returns service health payload', async () => {
    const request = new Request('http://localhost:8081/api/health');
    const response = GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.service).toBe('expo-template-api');
    expect(json.data.status).toBe('ok');
    expect(json.meta.env).toBe('test');
    expect(json.meta.origin).toBe('http://localhost:8081');
  });
});
