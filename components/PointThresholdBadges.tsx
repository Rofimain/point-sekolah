/** Ambang poin dari env publik (default sama dengan lib/utils getPointStatus). */
export const WARNING_POINTS = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "50", 10);
export const CRITICAL_POINTS = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75", 10);

export function PointBadge({
  points,
  alertPoints = WARNING_POINTS,
  criticalPoints = CRITICAL_POINTS,
}: {
  points: number;
  alertPoints?: number;
  criticalPoints?: number;
}) {
  const colors =
    points >= criticalPoints
      ? (["var(--danger-bg)", "var(--danger)"] as const)
      : points >= alertPoints
        ? (["var(--warning-bg)", "var(--warning)"] as const)
        : (["var(--success-bg)", "var(--success)"] as const);
  return (
    <span
      className="badge-soft"
      style={{
        background: colors[0],
        color: colors[1],
        borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
      }}
    >
      {points}
    </span>
  );
}

export function StatusBadge({
  points,
  alertPoints = WARNING_POINTS,
  criticalPoints = CRITICAL_POINTS,
}: {
  points: number;
  alertPoints?: number;
  criticalPoints?: number;
}) {
  const status =
    points >= criticalPoints
      ? (["var(--danger-bg)", "var(--danger)", "Kritis"] as const)
      : points >= alertPoints
        ? (["var(--warning-bg)", "var(--warning)", "Perhatian"] as const)
        : (["var(--success-bg)", "var(--success)", "Normal"] as const);
  return (
    <span
      className="badge-soft px-2.5"
      style={{
        background: status[0],
        color: status[1],
        borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
      }}
    >
      {status[2]}
    </span>
  );
}

export function statusRank(points: number, alertPoints = WARNING_POINTS, criticalPoints = CRITICAL_POINTS) {
  if (points >= criticalPoints) return 2;
  if (points >= alertPoints) return 1;
  return 0;
}
