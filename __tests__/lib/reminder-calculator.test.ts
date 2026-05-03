import { buildReminderNodeFlags, deriveAutoReminder } from '@/lib/reminder-calculator';

describe('deriveAutoReminder (PRD §4.6)', () => {
  it('keeps a manual next review date instead of replacing it with RADS auto derivation', () => {
    const out = deriveAutoReminder({
      diseaseType: 'breast',
      examDate: '2024-03-15',
      birads: '3',
      manualOverrideDate: '2024-10-20',
    });

    expect(out).toEqual({
      kind: 'manual',
      nextExamDate: '2024-10-20',
      reason: '用户手动修改复查日',
    });
  });

  it('thyroid: TI-RADS 2 -> +12 months', () => {
    const out = deriveAutoReminder({
      diseaseType: 'thyroid',
      examDate: '2024-03-15',
      tirads: '2',
    });
    expect(out.kind).toBe('auto');
    expect(out.nextExamDate).toBe('2025-03-15');
  });

  it('thyroid: TI-RADS 3 -> +9 months (6-12 months midpoint)', () => {
    const out = deriveAutoReminder({
      diseaseType: 'thyroid',
      examDate: '2024-03-15',
      tirads: '3',
    });
    expect(out.kind).toBe('auto');
    expect(out.nextExamDate).toBe('2024-12-15');
  });

  it('thyroid: TI-RADS 4a -> no auto reminder', () => {
    const out = deriveAutoReminder({
      diseaseType: 'thyroid',
      examDate: '2024-03-15',
      tirads: '4a',
    });
    expect(out.kind).toBe('no_auto');
    expect(out.nextExamDate).toBeNull();
  });

  it('breast: BI-RADS 3 -> +6 months', () => {
    const out = deriveAutoReminder({
      diseaseType: 'breast',
      examDate: '2024-03-15',
      birads: '3',
    });
    expect(out.kind).toBe('auto');
    expect(out.nextExamDate).toBe('2024-09-15');
  });

  it('lung: Lung-RADS 2 -> +12 months; 4X -> no auto reminder', () => {
    const low = deriveAutoReminder({
      diseaseType: 'lung',
      examDate: '2024-03-15',
      lungRads: '2',
    });
    expect(low.kind).toBe('auto');
    expect(low.nextExamDate).toBe('2025-03-15');

    const high = deriveAutoReminder({
      diseaseType: 'lung',
      examDate: '2024-03-15',
      lungRads: '4X',
    });
    expect(high.kind).toBe('no_auto');
    expect(high.nextExamDate).toBeNull();
  });

  it('projects PRD four reminder node sent flags from days until review', () => {
    expect(buildReminderNodeFlags(45)).toEqual({ remind1m_sent: false, remind1w_sent: false, remind3d_sent: false, remind0d_sent: false });
    expect(buildReminderNodeFlags(30)).toEqual({ remind1m_sent: true, remind1w_sent: false, remind3d_sent: false, remind0d_sent: false });
    expect(buildReminderNodeFlags(7)).toEqual({ remind1m_sent: true, remind1w_sent: true, remind3d_sent: false, remind0d_sent: false });
    expect(buildReminderNodeFlags(3)).toEqual({ remind1m_sent: true, remind1w_sent: true, remind3d_sent: true, remind0d_sent: false });
    expect(buildReminderNodeFlags(0)).toEqual({ remind1m_sent: true, remind1w_sent: true, remind3d_sent: true, remind0d_sent: true });
  });
});
