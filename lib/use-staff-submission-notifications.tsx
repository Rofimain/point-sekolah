"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  loadStaffSubmissionReadIds,
  persistStaffSubmissionReadIds,
  pruneStaffSubmissionReadIds,
} from "@/lib/staff-submission-reads";
import {
  STAFF_SUBMISSION_NOTIFICATIONS_PATH,
  STAFF_SUBMISSION_POLL_HIDDEN_MS,
  STAFF_SUBMISSION_POLL_MS,
  type StudentSubmissionNotification,
} from "@/lib/staff-submission-notifications";

type ApiResponse = {
  revision: string;
  items: StudentSubmissionNotification[];
};

type StaffSubmissionNotificationsValue = {
  items: StudentSubmissionNotification[];
  readSet: Set<string>;
  readReady: boolean;
  unreadCount: number;
  markRead: (id: string) => void;
  lastFetchedAt: Date | null;
};

const StaffSubmissionNotificationsContext = createContext<StaffSubmissionNotificationsValue | null>(null);

export function StaffSubmissionNotificationsProvider({ children }: { children: ReactNode }) {
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set());
  const [readReady, setReadReady] = useState(false);
  const [items, setItems] = useState<StudentSubmissionNotification[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setReadSet(loadStaffSubmissionReadIds());
    setReadReady(true);
  }, []);

  const markRead = useCallback((id: string) => {
    setReadSet((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistStaffSubmissionReadIds(next);
      return next;
    });
  }, []);

  const itemsKey = useMemo(() => items.map((i) => i.id).join(","), [items]);
  useEffect(() => {
    if (!itemsKey) return;
    const validIdSet = new Set(itemsKey.split(",").filter(Boolean));
    const pruned = pruneStaffSubmissionReadIds(validIdSet);
    setReadSet(pruned);
  }, [itemsKey]);

  const unreadCount = useMemo(
    () => (readReady ? items.filter((i) => !readSet.has(i.id)).length : 0),
    [items, readSet, readReady]
  );

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(STAFF_SUBMISSION_NOTIFICATIONS_PATH, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ApiResponse;
        setItems(data.items);
        setLastFetchedAt(new Date());
      } catch {
        /* abaikan error jaringan sesekali */
      }
    }

    function clearTimer() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    function armTimer() {
      clearTimer();
      const ms =
        typeof document !== "undefined" && document.hidden ? STAFF_SUBMISSION_POLL_HIDDEN_MS : STAFF_SUBMISSION_POLL_MS;
      pollTimerRef.current = setInterval(poll, ms);
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
  }, []);

  const value = useMemo(
    () => ({ items, readSet, readReady, unreadCount, markRead, lastFetchedAt }),
    [items, readSet, readReady, unreadCount, markRead, lastFetchedAt]
  );

  return (
    <StaffSubmissionNotificationsContext.Provider value={value}>
      {children}
    </StaffSubmissionNotificationsContext.Provider>
  );
}

export function useStaffSubmissionNotifications(): StaffSubmissionNotificationsValue {
  const ctx = useContext(StaffSubmissionNotificationsContext);
  if (!ctx) {
    throw new Error("useStaffSubmissionNotifications must be used within StaffSubmissionNotificationsProvider");
  }
  return ctx;
}
