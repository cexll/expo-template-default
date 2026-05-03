import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import HomePage from '@/app/(main)/index';
import RemindersPage from '@/app/(main)/reminders';
import SettingsPage from '@/app/(main)/settings';
import { LesionCard } from '@/components/LesionCard';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueries: jest.fn(() => []),
    useQuery: jest.fn(() => ({ data: undefined, isLoading: false })),
  };
});

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
}));

jest.mock('@/hooks/useLesions', () => ({
  useLesions: () => ({ data: [] }),
}));

jest.mock('@/hooks/useReminders', () => ({
  useActiveReminders: () => ({ data: [] }),
  useCreateReminder: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeactivateReminder: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateReminder: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/useExaminations', () => ({
  useLatestExaminationsByProfile: () => ({ data: [] }),
}));

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({ data: null, isLoading: false }),
  formatSubscriptionPlan: (plan: string) => plan,
}));

jest.mock('@/providers/active-profile-provider', () => ({
  useActiveProfile: () => ({
    activeProfileId: null,
    setActiveProfileId: jest.fn(),
    bootstrapHomeDefaultProfile: jest.fn(),
  }),
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: null,
    signOut: jest.fn(),
  }),
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

describe('main shell style bridge regression guard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bridges className styling for the home surface', () => {
    const tree = render(<HomePage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the reminders surface', () => {
    const tree = render(<RemindersPage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the settings surface', () => {
    const tree = render(<SettingsPage />).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });

  it('bridges className styling for the shared shell card, badge, switcher, and lesion card components', () => {
    const tree = render(
      <>
        <Card className="mb-3">
          <Badge text="23天后" variant="increase" />
        </Card>
        <ProfileSwitcher
          profiles={[
            { id: 'profile_1', nickname: '本人', subtitle: '2个病灶', isUrgent: false },
            { id: 'profile_2', nickname: '妈妈', subtitle: '3天后!', isUrgent: true },
          ]}
          activeId="profile_1"
          onSelect={jest.fn()}
          onAdd={jest.fn()}
        />
        <LesionCard
          title="左叶结节"
          subtitle="甲状腺 · 左叶"
          statusBadge={{ text: '▲ 增大', variant: 'increase' }}
          latestSize="10×8mm"
          radsGrade="TI-RADS 4a"
          baselineChange="▲25%"
          recordCount={2}
          reminderText="7天后复查"
          reminderTone="urgent"
          onPress={jest.fn()}
        />
      </>
    ).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });
});
