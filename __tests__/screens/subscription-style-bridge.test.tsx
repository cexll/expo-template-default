import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import SubscriptionPage from '@/app/subscription';
import SubscriptionSuccessPage from '@/app/subscription/success';
import { PaywallSheet } from '@/components/PaywallSheet';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
  },
  AuthError: class AuthError extends Error {},
  ApiError: class ApiError extends Error {
    code: number;
    status: number;

    constructor(message: string, code: number, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  },
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const apiMock = api as unknown as {
  get: jest.Mock;
};

const useAuthMock = useAuth as unknown as jest.Mock;

function renderWithQueryClient(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

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

describe('subscription style bridge regression guard', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', phone: '13800000000' },
      signOut: jest.fn(),
    });
    apiMock.get.mockResolvedValue({ plan: 'free', is_active: false, expires_at: null });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bridges className styling for the subscription purchase surface', () => {
    const tree = renderWithQueryClient(<SubscriptionPage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the subscription success surface', () => {
    const tree = renderWithQueryClient(<SubscriptionSuccessPage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the shared paywall presentation component', () => {
    const tree = render(<PaywallSheet visible onClose={jest.fn()} feature="AI识别" />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });
});
