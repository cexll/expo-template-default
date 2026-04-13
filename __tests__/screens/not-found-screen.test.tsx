import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import NotFoundScreen from '@/app/+not-found';

const mockLink = jest.fn(({ children }: { children: React.ReactNode }) => <Text>{children}</Text>);

jest.mock('expo-router', () => ({
  Link: (props: { children: React.ReactNode }) => mockLink(props),
}));

describe('NotFoundScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders 404 content and home link', () => {
    render(<NotFoundScreen />);

    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('页面不存在')).toBeTruthy();
    expect(screen.getByText('返回首页')).toBeTruthy();
    expect(mockLink).toHaveBeenCalledWith(
      expect.objectContaining({
        href: '/',
      })
    );
  });
});
