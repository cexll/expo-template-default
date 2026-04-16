import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import LoginPage from '@/app/(auth)/login';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const mockUseAuth = jest.fn();

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
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

describe('auth style bridge regression guard', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      isNewUser: false,
      signInWithSms: jest.fn(),
      signInWithWechat: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bridges className styling for the login screen host surface', () => {
    const tree = render(<LoginPage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the shared input primitive used by auth', () => {
    const tree = render(<Input label="手机号" value="" onChangeText={jest.fn()} placeholder="请输入手机号" />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the shared button primitive used by auth', () => {
    const tree = render(<Button title="获取验证码" onPress={jest.fn()} fullWidth />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });
});
