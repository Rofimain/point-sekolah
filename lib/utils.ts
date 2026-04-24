import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "dd MMM yyyy", { locale: localeId });
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "dd MMM yyyy, HH:mm", { locale: localeId });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getPointStatus(points: number) {
  const critical = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75");
  const warning = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "50");
  if (points >= critical) return "kritis";
  if (points >= warning) return "perhatian";
  return "normal";
}

export function getCategoryLabel(category: string) {
  const map: Record<string, string> = {
    RINGAN: "Ringan",
    SEDANG: "Sedang",
    BERAT: "Berat",
  };
  return map[category] || category;
}

export function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    STUDENT: "Siswa",
    TEACHER: "Guru",
    SUPER_ADMIN: "Super Admin",
  };
  return map[role] || role;
}
