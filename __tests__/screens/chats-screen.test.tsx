import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ChatsScreen from '@/app/(tabs)/index';
import { fetchJson } from '@/lib/api/client';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 56,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/lib/api/client', () => ({
  fetchJson: jest.fn(),
}));

const fetchJsonMock = jest.mocked(fetchJson);
const mockPush = jest.fn();

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

describe('ChatsScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state while health request is pending', async () => {
    const pending = deferred<{ data: { service: string; status: string; timestamp: string }; ok: boolean }>();
    fetchJsonMock.mockReturnValue(pending.promise as ReturnType<typeof fetchJson>);

    render(<ChatsScreen />);

    expect(screen.getByText('加载中...')).toBeTruthy();

    await act(async () => {
      pending.resolve({
        data: {
          service: 'expo-template-api',
          status: 'ok',
          timestamp: '2026-04-13T00:00:00.000Z',
        },
        ok: true,
      });
      await pending.promise;
    });
  });

  it('shows success state after health request resolves', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        service: 'expo-template-api',
        status: 'ok',
        timestamp: '2026-04-13T00:00:00.000Z',
      },
      ok: true,
    });

    render(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('ok · expo-template-api')).toBeTruthy();
    });
  });

  it('shows error state after health request fails', async () => {
    fetchJsonMock.mockRejectedValue(new Error('Network request failed'));

    render(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Network request failed')).toBeTruthy();
    });
  });

  it('navigates to detail page when a chat row is pressed', async () => {
    const pending = deferred<{ data: { service: string; status: string; timestamp: string }; ok: boolean }>();
    fetchJsonMock.mockReturnValue(pending.promise as ReturnType<typeof fetchJson>);

    render(<ChatsScreen />);

    fireEvent.press(screen.getByText('李娜'));

    expect(mockPush).toHaveBeenCalledWith('/entry/chat-li-na');

    await act(async () => {
      pending.resolve({
        data: {
          service: 'expo-template-api',
          status: 'ok',
          timestamp: '2026-04-13T00:00:00.000Z',
        },
        ok: true,
      });
      await pending.promise;
    });
  });
});
