import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { ReminderSideEffectRunner } from '@/components/reminder-side-effect-runner';
import { applyStartupReminderNotificationDelivery } from '@/lib/reminder-side-effects';

jest.mock('@/lib/reminder-side-effects', () => ({
  applyStartupReminderNotificationDelivery: jest.fn().mockResolvedValue({ delivery: { ok: true, delivered: 0 } }),
}));

const applyStartupReminderNotificationDeliveryMock = jest.mocked(applyStartupReminderNotificationDelivery);

describe('ReminderSideEffectRunner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('runs startup notification delivery without invoking full reminder sync side effects', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<ReminderSideEffectRunner />);

    await waitFor(() => {
      expect(applyStartupReminderNotificationDeliveryMock).toHaveBeenCalledTimes(1);
    });
  });
});
