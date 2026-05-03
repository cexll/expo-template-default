import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { AuthGuard } from '@/components/AuthGuard';

const mockReplace = jest.fn();
const mockUseSegments = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: any[]) => mockReplace(...args),
  },
  useSegments: () => mockUseSegments(),
  usePathname: () => mockUsePathname(),
}));

const mockUseAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseProfiles = jest.fn();
jest.mock('@/hooks/useProfiles', () => ({
  useProfiles: (...args: any[]) => mockUseProfiles(...args),
}));

describe('AuthGuard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated users away from /(main)', async () => {
    mockUseSegments.mockReturnValue(['(main)', 'index']);
    mockUsePathname.mockReturnValue('/');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('keeps unauthenticated users on onboarding', async () => {
    mockUseSegments.mockReturnValue(['(auth)', 'onboarding']);
    mockUsePathname.mockReturnValue('/onboarding');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users away from record routes', async () => {
    mockUseSegments.mockReturnValue(['record', 'recognize']);
    mockUsePathname.mockReturnValue('/record/recognize');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('routes authenticated users on record routes to onboarding when no profile exists', async () => {
    mockUseSegments.mockReturnValue(['record', 'upload']);
    mockUsePathname.mockReturnValue('/record/upload');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
  });

  it('routes authenticated users to onboarding when no profile exists', async () => {
    mockUseSegments.mockReturnValue(['(main)', 'index']);
    mockUsePathname.mockReturnValue('/');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
  });

  it('ignores prototype home seed query params when deciding onboarding', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?prototypeHomeSeed=demo' },
    });
    mockUseSegments.mockReturnValue(['(main)', 'index']);
    mockUsePathname.mockReturnValue('/');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('ignores prototype detail seed query params for unauthenticated routes', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?prototypeDetailSeed=demo' },
    });
    mockUseSegments.mockReturnValue(['lesion', '[id]']);
    mockUsePathname.mockReturnValue('/lesion/lesion-1');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('ignores prototype detail seed query params when deciding onboarding', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?prototypeDetailSeed=demo' },
    });
    mockUseSegments.mockReturnValue(['lesion', '[id]', 'compare']);
    mockUsePathname.mockReturnValue('/lesion/lesion-1/compare');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('ignores prototype UI-005 seed query params for unauthenticated routes', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?prototypeUi005Seed=demo' },
    });
    mockUseSegments.mockReturnValue(['subscription', 'success']);
    mockUsePathname.mockReturnValue('/subscription/success');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('ignores prototype UI-005 seed query params when deciding onboarding', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?prototypeUi005Seed=demo' },
    });
    mockUseSegments.mockReturnValue(['(main)', 'reminders']);
    mockUsePathname.mockReturnValue('/reminders');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps unauthenticated VAL-UI-001 repository evidence route accessible for browser evidence', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?validationUiSeed=repository' },
    });
    mockUseSegments.mockReturnValue(['validation-ui-evidence']);
    mockUsePathname.mockReturnValue('/validation-ui-evidence');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps authenticated VAL-UI-001 repository evidence route while local seed is empty', async () => {
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { search: '?validationUiSeed=repository' },
    });
    mockUseSegments.mockReturnValue(['validation-ui-evidence']);
    mockUsePathname.mockReturnValue('/validation-ui-evidence');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('routes authenticated users away from login when profile exists', async () => {
    mockUseSegments.mockReturnValue(['(auth)', 'login']);
    mockUsePathname.mockReturnValue('/login');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [{ id: 'profile-1' }], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(main)');
    });
  });

  it('avoids redirect loops on onboarding route', async () => {
    mockUseSegments.mockReturnValue(['(auth)', 'onboarding']);
    mockUsePathname.mockReturnValue('/onboarding');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: true });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not reference prototype-review seed bypass helpers in production AuthGuard', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src/components/AuthGuard.tsx'), 'utf8');

    expect(source).not.toMatch(/prototype(?:Home|Detail|Ui005)Seed|hasPrototypeSeedParam|prototype-review/);
    expect(source).toContain('validationUiSeed=repository');
  });
});

