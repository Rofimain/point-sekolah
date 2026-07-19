/**
 * Tangga z-index UI Point Sekolah (overlay stacking).
 *
 * | Layer              | Nilai | Penggunaan |
 * |--------------------|-------|------------|
 * | navBackdrop        | 40    | Backdrop drawer admin (di bawah sidebar) |
 * | sidebar            | 50    | Panel drawer admin (mobile) |
 * | topBar             | 60    | Sticky TopBar |
 * | dropdown           | 70    | Dropdown lonceng / picker siswa |
 * | sheet              | 80    | Sheet sekunder (kelas / import) |
 * | sheetElevated      | 90    | Sheet di atas sheet lain |
 * | modal              | 100   | Dialog form (Records, Users, Violations, bukti) |
 * | modalElevated      | 200   | Dialog kritis (ubah password, sukses QRIS) |
 * | toast              | 300   | Sonner toaster — selalu di atas modal |
 *
 * Aturan: modal aplikasi ≥ 100 agar selalu di atas TopBar (60).
 * Feedback error/sukses di dalam modal (jangan banner halaman di belakang overlay).
 * Portal ke document.body wajib untuk overlay di dalam <main> yang di-scroll.
 */
export const Z_INDEX = {
  navBackdrop: 40,
  sidebar: 50,
  topBar: 60,
  dropdown: 70,
  sheet: 80,
  sheetElevated: 90,
  modal: 100,
  modalElevated: 200,
  toast: 300,
} as const;

/** Class Tailwind untuk z-index modal standar (di atas TopBar). */
export const Z_MODAL_CLASS = "z-[100]";
export const Z_MODAL_ELEVATED_CLASS = "z-[200]";
export const Z_TOAST_CLASS = "z-[300]";

let scrollLockCount = 0;
let prevBodyOverflow = "";
let prevMainOverflowY: string | null = null;

/**
 * Kunci scroll body + <main> admin (container scroll sebenarnya).
 * Aman untuk nested lock (counter); restore saat count kembali 0.
 */
export function lockAppScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  const main = document.querySelector("main");
  if (scrollLockCount === 0) {
    prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (main instanceof HTMLElement) {
      prevMainOverflowY = main.style.overflowY;
      main.style.overflowY = "hidden";
    } else {
      prevMainOverflowY = null;
    }
  }
  scrollLockCount += 1;

  return () => {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount > 0) return;
    document.body.style.overflow = prevBodyOverflow;
    const m = document.querySelector("main");
    if (m instanceof HTMLElement && prevMainOverflowY !== null) {
      m.style.overflowY = prevMainOverflowY;
    }
    prevMainOverflowY = null;
  };
}
