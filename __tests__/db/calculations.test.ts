import {
  calculateBaselineChange,
  calculatePreviousChange,
  formatChangeDisplay,
} from '@/lib/db/calculations';

describe('db calculations', () => {
  it('formats baseline increase with PRD display semantics', () => {
    expect(formatChangeDisplay(calculateBaselineChange(8.3, 6.8), 'baseline')).toEqual({
      type: 'increase',
      indicator: '▲',
      absoluteLabel: '+1.5mm 较基线',
      percentageLabel: '+22%',
      summaryLabel: '较基线增大',
    });
  });

  it('returns positive baseline change', () => {
    expect(calculateBaselineChange(8.3, 6.8)).toEqual({
      absolute: 1.5,
      percentage: 22,
    });
  });

  it('returns negative baseline change', () => {
    expect(calculateBaselineChange(5.0, 6.8)).toEqual({
      absolute: -1.8,
      percentage: -26,
    });
  });

  it('returns zero baseline change when values match', () => {
    expect(calculateBaselineChange(6.8, 6.8)).toEqual({
      absolute: 0,
      percentage: 0,
    });
  });

  it('returns previous change', () => {
    expect(calculatePreviousChange(8.3, 7.5)).toEqual({
      absolute: 0.8,
      percentage: 11,
    });
  });
});
