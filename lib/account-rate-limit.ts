type Entry = { attempts: number; resetAt: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const globalStore = globalThis as typeof globalThis & { __accountPasswordAttempts?: Map<string, Entry> };
const attempts = globalStore.__accountPasswordAttempts ?? new Map<string, Entry>();
if (process.env.NODE_ENV !== "production") globalStore.__accountPasswordAttempts = attempts;

export function passwordAttemptStatus(userId: string, now = Date.now()) {
  const current = attempts.get(userId);
  if (!current || current.resetAt <= now) {
    attempts.delete(userId);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: current.attempts < MAX_ATTEMPTS,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function recordFailedPasswordAttempt(userId: string, now = Date.now()) {
  const current = attempts.get(userId);
  if (!current || current.resetAt <= now) attempts.set(userId, { attempts: 1, resetAt: now + WINDOW_MS });
  else current.attempts += 1;
}

export function clearPasswordAttempts(userId: string) {
  attempts.delete(userId);
}
