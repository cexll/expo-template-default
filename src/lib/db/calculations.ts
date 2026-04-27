type ChangeReference = 'baseline' | 'previous';

type ChangeDisplay = {
  type: 'increase' | 'decrease' | 'unchanged';
  indicator: '▲' | '▼' | '—';
  absoluteLabel: string;
  percentageLabel: string;
  summaryLabel: string;
};

type ChangeResult = {
  absolute: number;
  percentage: number;
};

function roundToOneDecimal(value: number) {
  return Number(value.toFixed(1));
}

function calculateChange(current: number, reference: number): ChangeResult {
  const absolute = roundToOneDecimal(current - reference);

  if (reference === 0) {
    return { absolute, percentage: 0 };
  }

  return {
    absolute,
    percentage: Math.round(((current - reference) / reference) * 100),
  };
}

export function calculateBaselineChange(current: number, baseline: number): ChangeResult {
  return calculateChange(current, baseline);
}

export function calculatePreviousChange(current: number, previous: number): ChangeResult {
  return calculateChange(current, previous);
}

export function formatChangeDisplay(change: ChangeResult, reference: ChangeReference): ChangeDisplay {
  const referenceLabel = reference === 'baseline' ? '较基线' : '较上次';

  if (change.absolute === 0) {
    return {
      type: 'unchanged',
      indicator: '—',
      absoluteLabel: '— 未变',
      percentageLabel: '0%',
      summaryLabel: '未变',
    };
  }

  const increased = change.absolute > 0;
  const absolutePrefix = increased ? '+' : '';
  const percentagePrefix = change.percentage > 0 ? '+' : '';

  return {
    type: increased ? 'increase' : 'decrease',
    indicator: increased ? '▲' : '▼',
    absoluteLabel: `${absolutePrefix}${change.absolute.toFixed(1)}mm ${referenceLabel}`,
    percentageLabel: `${percentagePrefix}${change.percentage}%`,
    summaryLabel: `${referenceLabel}${increased ? '增大' : '缩小'}`,
  };
}
