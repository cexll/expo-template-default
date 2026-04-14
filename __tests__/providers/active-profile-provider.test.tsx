import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { ActiveProfileProvider, useActiveProfile } from '@/providers/active-profile-provider';

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

let mockProfilesData: { id: string }[] = [];
let mockProfilesFetched = false;

jest.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => ({
    data: mockProfilesData,
    isFetched: mockProfilesFetched,
  }),
}));

function Consumer() {
  const { activeProfileId } = useActiveProfile();
  return <Text testID="active-profile-id">{activeProfileId}</Text>;
}

describe('ActiveProfileProvider', () => {
  beforeEach(() => {
    mockProfilesData = [];
    mockProfilesFetched = false;
    try {
      globalThis.localStorage?.clear();
    } catch {
      // ignore
    }
  });

  it('preserves stored active profile while profiles are still loading', async () => {
    globalThis.localStorage?.setItem('active_profile_id', 'profile-2');

    const tree = render(
      <ActiveProfileProvider>
        <Consumer />
      </ActiveProfileProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-profile-id').props.children).toBe('profile-2');
    });

    // Simulate profiles query finishing later.
    mockProfilesData = [{ id: 'profile-1' }, { id: 'profile-2' }];
    mockProfilesFetched = true;

    tree.rerender(
      <ActiveProfileProvider>
        <Consumer />
      </ActiveProfileProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-profile-id').props.children).toBe('profile-2');
    });

    expect(globalThis.localStorage?.getItem('active_profile_id')).toBe('profile-2');
  });
});
