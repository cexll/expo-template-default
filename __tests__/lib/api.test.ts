import { ApiError, AuthError, api } from '@/lib/api';

describe('api smoke', () => {
  it('exports api helpers and error classes', () => {
    expect(api).toBeDefined();
    expect(api.get).toBeDefined();
    expect(api.post).toBeDefined();
    expect(api.upload).toBeDefined();
    expect(AuthError).toBeDefined();
    expect(ApiError).toBeDefined();
  });
});
