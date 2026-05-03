import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import OnboardingPage from '@/app/(auth)/onboarding';
import CreateProfilePage from '@/app/(main)/profiles/new';
import { Tag } from '@/components/ui/Tag';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

const mockUseAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseProfiles = jest.fn();
const mockUseSubscriptionStatus = jest.fn();
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

const mockSetActiveProfileId = jest.fn();
jest.mock('@/providers/active-profile-provider', () => ({
  useActiveProfile: () => ({
    activeProfileId: null,
    setActiveProfileId: mockSetActiveProfileId,
  }),
}));

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockUseSubscriptionStatus(),
}));

function collectClassNameProps(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null,
  path = 'root'
): string[] {
  if (node == null || typeof node === 'string') {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child, index) => collectClassNameProps(child, `${path}[${index}]`));
  }

  const currentPath = `${path}.${node.type}`;
  const currentNode = typeof node.props.className === 'string' ? [`${currentPath} -> ${node.props.className}`] : [];

  return currentNode.concat(
    (node.children ?? []).flatMap((child, index) => collectClassNameProps(child, `${currentPath}[${index}]`))
  );
}

describe('profile form style bridge regression guard', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isNewUser: true,
    });
    mockUseProfiles.mockReturnValue({ data: [] });
    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bridges className styling for the onboarding surface', () => {
    const tree = render(<OnboardingPage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the add-profile surface', () => {
    const tree = render(<CreateProfilePage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the shared tag primitive used by both profile forms', () => {
    const tree = render(<Tag text="男" selected onPress={jest.fn()} />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });
});
