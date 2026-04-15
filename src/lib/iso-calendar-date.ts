const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number) {
  // Gregorian leap year rules.
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

function daysInMonth(year: number, month: number) {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Strictly validates an ISO "calendar date" string in the form YYYY-MM-DD.
 *
 * - Rejects impossible dates like 2026-02-31 (unlike JS Date normalization).
 * - Returns the canonical YYYY-MM-DD string on success, otherwise null.
 */
export function parseStrictIsoCalendarDate(value: string) {
  const trimmed = value.trim();
  const match = ISO_CALENDAR_DATE.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;

  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;

  return trimmed;
}
