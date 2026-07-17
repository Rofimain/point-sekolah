/** Di basis data: pengurangan 25% setelah periode tenang. */
export const QUIET_MONTH_REASON = "QUIET_MONTH_REDUCTION";

/** Label tampilan untuk nilai `reason` penyesuaian poin. */
export function formatPointAdjustmentReason(reason: string): string {
  if (reason === QUIET_MONTH_REASON) return "Remisi periode tenang";
  return reason;
}
