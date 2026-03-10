/**
 * 展示前 sanitize iteration_count：NaN/负/小数 处理
 * TASKS_iteration_count_display US-005
 */
export function sanitizeIterationCount(val: number | undefined | null): number {
  if (val == null) return 0;
  if (Number.isNaN(val)) return 0;
  return Math.max(0, Math.round(val));
}
