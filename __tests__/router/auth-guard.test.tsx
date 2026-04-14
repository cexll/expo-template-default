import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { AuthGuard } from '@/components/AuthGuard';

const mockReplace = jest.fn();
const mockUseSegments = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: any[]) => mockReplace(...args),
  },
  useSegments: () => mockUseSegments(),
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
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('routes authenticated users to onboarding when no profile exists', async () => {
    mockUseSegments.mockReturnValue(['(main)', 'index']);
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    });
  });

  it('routes authenticated users away from login when profile exists', async () => {
    mockUseSegments.mockReturnValue(['(auth)', 'login']);
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [{ id: 'profile-1' }], isLoading: false });

    render(<AuthGuard />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(main)');
    });
  });

  it('avoids redirect loops on onboarding route', async () => {
    mockUseSegments.mockReturnValue(['(auth)', 'onboarding']);
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: true });
    mockUseProfiles.mockReturnValue({ data: [], isLoading: false });

    render(<AuthGuard />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

