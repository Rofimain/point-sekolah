"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ForceChangePasswordGate } from "@/components/account/ForceChangePasswordGate";
import { Z_INDEX } from "@/lib/ui-layers";

/** Session hanya untuk area /form — halaman login tidak memuat next-auth session di root. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ForceChangePasswordGate />
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={4000}
        style={{ zIndex: Z_INDEX.toast }}
        toastOptions={{ style: { zIndex: Z_INDEX.toast } }}
      />
    </SessionProvider>
  );
}
