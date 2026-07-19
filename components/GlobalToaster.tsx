"use client";

import { Toaster } from "sonner";
import { Z_INDEX } from "@/lib/ui-layers";

/** Toast global admin — z di atas modal supaya tidak ketutup dialog. */
export function GlobalToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={3500}
      style={{ zIndex: Z_INDEX.toast }}
      toastOptions={{ style: { zIndex: Z_INDEX.toast } }}
    />
  );
}
