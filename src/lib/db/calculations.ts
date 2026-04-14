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
