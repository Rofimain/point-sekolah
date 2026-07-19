"use client";

import { useSession } from "next-auth/react";
import { ChangePasswordDialog } from "@/components/account/ChangePasswordDialog";

/** Overlay wajib ganti password — tidak bisa dilewati sampai password diganti. */
export function ForceChangePasswordGate() {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !session?.user?.mustChangePassword) return null;
  return <ChangePasswordDialog role={session.user.role} forced />;
}
