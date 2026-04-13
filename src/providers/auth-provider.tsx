import React from 'react';

export type AuthUser = {
  id: string;
  name: string;
  role: 'demo';
};

type AuthContextValue = {
  signInDemo: () => void;
  signOut: () => void;
  user: AuthUser | null;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  name: 'Chen Wenjie',
  role: 'demo',
};

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = React.useState<AuthUser | null>(null);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      signInDemo: () => setUser(DEMO_USER),
      signOut: () => setUser(null),
      user,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
