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
  const variant =
    points >= criticalPoints ? "badge-danger" : points >= alertPoints ? "badge-warning" : "badge-success";
  return <span className={`badge-soft tabular-nums ${variant}`}>{points}</span>;
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
      ? (["badge-danger", "Kritis"] as const)
      : points >= alertPoints
        ? (["badge-warning", "Perhatian"] as const)
        : (["badge-success", "Normal"] as const);
  return <span className={`badge-soft px-2.5 ${status[0]}`}>{status[1]}</span>;
}

export function statusRank(points: number, alertPoints = WARNING_POINTS, criticalPoints = CRITICAL_POINTS) {
  if (points >= criticalPoints) return 2;
  if (points >= alertPoints) return 1;
  return 0;
}
