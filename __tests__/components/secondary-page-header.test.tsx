import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';

const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: any[]) => mockRouterBack(...args),
    canGoBack: (...args: any[]) => mockRouterCanGoBack(...args),
    replace: (...args: any[]) => mockRouterReplace(...args),
  },
}));

describe('SecondaryPageHeader', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses router.back when navigation history exists', () => {
    mockRouterCanGoBack.mockReturnValue(true);

    render(<SecondaryPageHeader title="上传报告" fallbackHref="/(main)" />);

    fireEvent.press(screen.getByLabelText('返回上一层'));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('falls back to the provided logical parent when there is no history', () => {
    mockRouterCanGoBack.mockReturnValue(false);

    render(<SecondaryPageHeader title="上传报告" fallbackHref="/(main)" />);

    fireEvent.press(screen.getByLabelText('返回上一层'));

    expect(mockRouterReplace).toHaveBeenCalledWith('/(main)');
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
