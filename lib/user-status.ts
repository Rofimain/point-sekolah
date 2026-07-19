import type { UserStatus } from "@/generated/prisma/client";

/** Filter operasional: user yang masih “hidup” di sistem. */
export const ACTIVE_USER_WHERE = { status: "ACTIVE" as const };

export function canUserLogin(status: UserStatus | string | null | undefined): boolean {
  return status === "ACTIVE";
}

/** Dual-write: `active` selalu mengikuti apakah status ACTIVE. */
export function activeFlagFromStatus(status: UserStatus): boolean {
  return status === "ACTIVE";
}

/**
 * Toggle UI legacy `{ active: boolean }` → status.
 * true → ACTIVE; false → SUSPENDED (blokir sementara, bukan lulus/keluar).
 */
export function statusFromActiveToggle(active: boolean): UserStatus {
  return active ? "ACTIVE" : "SUSPENDED";
}

export function lifecycleFieldsForStatus(
  status: UserStatus,
  now = new Date()
): {
  status: UserStatus;
  active: boolean;
  graduatedAt?: Date | null;
  leftAt?: Date | null;
} {
  const base = {
    status,
    active: activeFlagFromStatus(status),
  };
  if (status === "GRADUATED") {
    return { ...base, graduatedAt: now };
  }
  if (status === "LEFT") {
    return { ...base, leftAt: now };
  }
  if (status === "ACTIVE") {
    return { ...base, graduatedAt: null, leftAt: null };
  }
  return base;
}

export function softDeleteStatus(): UserStatus {
  return "LEFT";
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  GRADUATED: "Lulus",
  LEFT: "Keluar",
  SUSPENDED: "Ditangguhkan",
};
