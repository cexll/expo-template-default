// Simple smoke test: validates the component module exports a default page.
describe('Login Page', () => {
  it('should export a default component', () => {
    const LoginModule = require('../../src/app/(auth)/login');
    expect(LoginModule.default).toBeDefined();
  });
});
