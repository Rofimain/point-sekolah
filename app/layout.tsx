import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMAN 1 Contoh";

export const metadata: Metadata = {
  title: `Sistem Poin Pelanggaran — ${SCHOOL_NAME}`,
  description: `Portal Sistem Poin Pelanggaran Siswa ${SCHOOL_NAME}`,
  icons: {
    icon: [{ url: "/brand-logo.png", type: "image/png" }],
    shortcut: "/brand-logo.png",
    apple: [{ url: "/brand-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
