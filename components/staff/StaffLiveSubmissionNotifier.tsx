"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const POLL_MS = 5000;
const POLL_HIDDEN_MS = 45000;

type TipResponse = {
  revision: string;
  preview: null | { studentName: string; violationName: string; points: number };
};

export function StaffLiveSubmissionNotifier() {
  const router = useRouter();
  const baselineRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/staff/student-submissions-tip", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as TipResponse;
        const rev = data.revision;

        if (baselineRef.current === null) {
          baselineRef.current = rev;
          return;
        }
        if (rev !== baselineRef.current && rev !== "none") {
          baselineRef.current = rev;
          const p = data.preview;
          const msg = p
            ? `${p.studentName} · ${p.violationName} (${p.points} poin)`
            : "Ada laporan pelanggaran baru dari siswa.";
          toast.info("Laporan baru dari siswa", {
            description: msg,
            duration: 8000,
            action: {
              label: "Buka catatan",
              onClick: () => {
                router.push("/records");
              },
            },
          });
        }
      } catch {
        /* abaikan error jaringan sesekali */
      }
    }

    function clearTimer() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function armTimer() {
      clearTimer();
      const ms = typeof document !== "undefined" && document.hidden ? POLL_HIDDEN_MS : POLL_MS;
      timerRef.current = setInterval(poll, ms);
    }

    poll();
    armTimer();

    function onVisibility() {
      if (!document.hidden) poll();
      armTimer();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
