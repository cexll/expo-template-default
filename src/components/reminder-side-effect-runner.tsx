import { useEffect } from 'react';
import { Platform } from 'react-native';

import { applyStartupReminderNotificationDelivery } from '@/lib/reminder-side-effects';

export function ReminderSideEffectRunner() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void applyStartupReminderNotificationDelivery();
  }, []);

  return null;
}
