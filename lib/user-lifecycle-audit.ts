import { prisma } from "@/lib/prisma";

export type LifecycleActor = {
  id?: string | null;
  name?: string | null;
};

export type RecordLifecycleInput = {
  userId: string;
  event: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  actor?: LifecycleActor | null;
  meta?: Record<string, unknown> | null;
};

/** Audit lifecycle; gagal tulis tidak boleh menggagalkan operasi utama. */
export async function recordUserLifecycleEvent(input: RecordLifecycleInput): Promise<void> {
  try {
    await prisma.userLifecycleEvent.create({
      data: {
        userId: input.userId,
        event: input.event,
        fromStatus: input.fromStatus ?? undefined,
        toStatus: input.toStatus ?? undefined,
        reason: input.reason ?? undefined,
        actorId: input.actor?.id ?? undefined,
        actorName: input.actor?.name ?? undefined,
        meta: input.meta ? JSON.stringify(input.meta) : undefined,
      },
    });
  } catch (err) {
    console.error("[user-lifecycle] gagal menulis event", err);
  }
}

export async function recordUserLifecycleEvents(inputs: RecordLifecycleInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => recordUserLifecycleEvent(input)));
}
