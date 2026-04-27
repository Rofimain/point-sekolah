"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";

/** Session hanya untuk area /form — halaman login tidak memuat next-auth session di root. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-center" richColors closeButton duration={4000} />
    </SessionProvider>
  );
}
