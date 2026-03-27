/**
 * Format a Date to YYYY-MM-DD using local timezone (avoids UTC shift issues with toISOString)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate work hours between punchIn and punchOut, handling overnight shifts.
 * Returns hours as a number.
 */
export function calculateWorkHoursNum(punchIn: string, punchOut: string): number {
  const inTime = new Date(punchIn).getTime();
  const outTime = new Date(punchOut).getTime();
  let diff = outTime - inTime;
  const oneDayMs = 24 * 60 * 60 * 1000;
  while (diff < 0) diff += oneDayMs;
  return diff / (1000 * 60 * 60);
}

/**
 * Calculate work hours and return a formatted string like "8.50 hrs"
 */
export function calculateWorkHoursStr(punchIn: string, punchOut: string | null): string {
  if (!punchOut) return 'In Progress';
  const hours = calculateWorkHoursNum(punchIn, punchOut);
  return `${hours.toFixed(2)} hrs`;
}

/**
 * Calculate work hours and return formatted string like "8h 30m"
 */
export function calculateWorkHoursHM(punchIn: string, punchOut: string): string {
  const totalMs = (() => {
    let diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    return diff;
  })();
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
