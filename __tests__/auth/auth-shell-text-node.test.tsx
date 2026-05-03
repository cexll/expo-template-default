import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import LoginPage from '@/app/(auth)/login';
import OnboardingPage from '@/app/(auth)/onboarding';

const mockUseAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseProfiles = jest.fn();
const mockMutateAsync = jest.fn();
jest.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => mockUseProfiles(),
  useCreateProfile: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useCreateBackendProfile: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

const TEXT_HOST_TYPES = new Set(['Text', 'RCTText', 'VirtualText']);

function collectInvalidTextNodes(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null,
  path = 'root',
  parentType: string | null = null
): string[] {
  if (node == null) return [];

  if (typeof node === 'string') {
    if (parentType && !TEXT_HOST_TYPES.has(parentType)) {
      return [`${path} contains raw text ${JSON.stringify(node)} under <${parentType}>`];
    }
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child, index) => collectInvalidTextNodes(child, `${path}[${index}]`, parentType));
  }

  return (node.children ?? []).flatMap((child, index) =>
    collectInvalidTextNodes(child, `${path}.${node.type}[${index}]`, node.type)
  );
}

describe('auth shell text node regression guard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the login page without raw text nodes under View-like hosts', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      isNewUser: false,
      signInWithSms: jest.fn(),
      signInWithWechat: jest.fn(),
    });

    const tree = render(<LoginPage />).toJSON();

    expect(collectInvalidTextNodes(tree)).toEqual([]);
  });

  it('renders the onboarding page without raw text nodes under View-like hosts', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isNewUser: true,
    });
    mockUseProfiles.mockReturnValue({ data: [] });

    const tree = render(<OnboardingPage />).toJSON();

    expect(collectInvalidTextNodes(tree)).toEqual([]);
  });
});
