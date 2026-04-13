import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppErrorBoundary } from '@/components/app-error-boundary';

describe('AppErrorBoundary', () => {
  it('renders error message and retries', () => {
    const mockRetry = jest.fn();

    render(<AppErrorBoundary error={new Error('boom')} retry={mockRetry} />);

    expect(screen.getByText('页面发生错误')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();

    fireEvent.press(screen.getByText('重试'));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('falls back when error message is empty', () => {
    const error = new Error('');

    render(<AppErrorBoundary error={error} retry={jest.fn()} />);

    expect(screen.getByText('Unexpected error')).toBeTruthy();
  });
});
