import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';

import { AuthProvider, useAuth } from '@/providers/auth-provider';

function AuthConsumer() {
  const { signInDemo, signOut, user } = useAuth();

  return (
    <>
      <Text testID="auth-state">{user ? user.name : 'anonymous'}</Text>
      <Pressable testID="sign-in" onPress={signInDemo}>
        <Text>sign in</Text>
      </Pressable>
      <Pressable testID="sign-out" onPress={signOut}>
        <Text>sign out</Text>
      </Pressable>
    </>
  );
}

describe('AuthProvider', () => {
  it('toggles demo auth state', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByText('anonymous')).toBeTruthy();

    fireEvent.press(screen.getByTestId('sign-in'));
    expect(screen.getByText('Chen Wenjie')).toBeTruthy();

    fireEvent.press(screen.getByTestId('sign-out'));
    expect(screen.getByText('anonymous')).toBeTruthy();
  });

  it('throws when hook is used outside provider', () => {
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within AuthProvider');
  });
});
