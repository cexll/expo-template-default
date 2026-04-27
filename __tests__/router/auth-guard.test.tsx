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

  it('keeps unauthenticated users on onboarding for prototype review', async () => {
    mockUseSegments.mockReturnValue(['(auth)', 'onboarding']);
    mockUsePathname.mockReturnValue('/onboarding');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps unauthenticated users on prototype record routes for pixel review', async () => {
    mockUseSegments.mockReturnValue(['record', 'recognize']);
    mockUsePathname.mockReturnValue('/record/recognize');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps authenticated users on prototype record routes while local seed is empty', async () => {
    mockUseSegments.mockReturnValue(['record', 'upload']);
    mockUsePathname.mockReturnValue('/record/upload');
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
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

  it('keeps authenticated users on prototype home review route while local seed is empty', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps unauthenticated prototype detail review routes accessible for browser evidence', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps authenticated prototype compare review routes while local seed is empty', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps unauthenticated UI-005 prototype review routes accessible for browser evidence', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps authenticated UI-005 prototype review routes while local seed is empty', async () => {
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
});

