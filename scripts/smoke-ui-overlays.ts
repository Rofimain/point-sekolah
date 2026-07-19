/**
 * Static smoke checks for UI overlay / responsive release gates.
 * Run: npx tsx scripts/smoke-ui-overlays.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failed = 0;

function read(rel: string) {
  const p = join(root, rel);
  if (!existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return readFileSync(p, "utf8");
}

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`PASS  ${msg}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${msg}`);
  }
}

const students = read("app/(admin)/students/StudentsClient.tsx");
assert(students.includes("createPortal"), "Students modals use createPortal");
assert(students.includes("FlashBanner"), "Students shows flash inside modals");
assert(students.includes("!overlayOpen"), "Students page banner hidden while modal open");
assert(students.includes("Z_MODAL_CLASS"), "Students modals use Z_MODAL_CLASS");

const toaster = read("components/GlobalToaster.tsx");
assert(toaster.includes("Z_INDEX.toast"), "GlobalToaster uses toast z-index above modal");

const layers = read("lib/ui-layers.ts");
assert(layers.includes("Z_MODAL_CLASS"), "ui-layers exports Z_MODAL_CLASS");
assert(layers.includes("lockAppScroll"), "ui-layers exports lockAppScroll");
assert(layers.includes("querySelector(\"main\")"), "lockAppScroll targets main");
assert(layers.includes("toast: 300"), "ui-layers defines toast above modalElevated");

const evidence = read("components/records/EvidencePreviewModal.tsx");
assert(evidence.includes("createPortal"), "EvidencePreviewModal uses createPortal");
assert(evidence.includes("Z_MODAL_CLASS"), "EvidencePreviewModal z >= modal layer");
assert(evidence.includes("lockAppScroll"), "EvidencePreviewModal locks scroll");
assert(evidence.includes("var(--bg-secondary)"), "EvidencePreviewModal uses theme tokens");
assert(!/bg-white/.test(evidence), "EvidencePreviewModal has no bg-white");
assert(!/text-neutral-/.test(evidence), "EvidencePreviewModal has no text-neutral-*");

const qris = read("components/QrisStyleSuccessSheet.tsx");
assert(qris.includes("createPortal"), "Qris sheet uses createPortal");
assert(qris.includes("Z_MODAL_ELEVATED_CLASS"), "Qris sheet elevated z-index");
assert(qris.includes("var(--bg-secondary)"), "Qris sheet uses theme tokens");
assert(!/bg-white/.test(qris), "Qris sheet has no bg-white");

const password = read("components/account/ChangePasswordDialog.tsx");
assert(password.includes("createPortal"), "ChangePasswordDialog uses createPortal");
assert(password.includes("Z_MODAL_ELEVATED_CLASS"), "ChangePasswordDialog elevated z");

const records = read("app/(admin)/records/RecordsClient.tsx");
assert(records.includes("createPortal"), "Records modals use createPortal");
assert(records.includes("Z_MODAL_CLASS"), "Records modals use Z_MODAL_CLASS");
assert(!/fixed inset-0 z-50/.test(records), "Records no longer uses z-50 overlay");
assert(records.includes("md:hidden"), "Records has mobile card view");

const users = read("app/(admin)/users/UsersClient.tsx");
assert(users.includes("createPortal"), "Users modal uses createPortal");
assert(users.includes("min-h-11 min-w-11"), "Users checkbox hit area >= 44px");
assert(users.includes("md:hidden"), "Users has mobile card view");

const chrome = read("components/layouts/AdminChrome.tsx");
assert(chrome.includes("lockAppScroll"), "AdminChrome uses lockAppScroll for drawer");
assert(chrome.includes('id="admin-main-scroll"'), "Admin main scroll container id");

const topbar = read("components/layouts/TopBar.tsx");
assert(topbar.includes("Buka menu navigasi"), "TopBar hamburger aria-label");
assert(topbar.includes("sr-only sm:not-sr-only"), "TopBar compact icon-only actions");

const uploader = read("components/records/EvidenceMultiUploader.tsx");
assert(uploader.includes("min-h-11 min-w-11"), "Evidence Hapus touch target 44px");
assert(!uploader.includes("overflow-hidden rounded-lg border"), "Evidence tile not clipping Hapus with overflow-hidden");

const student = read("app/(student)/form/StudentFormClient.tsx");
assert(student.includes("md:hidden"), "Student history uses md card breakpoint");
assert(student.includes("EvidencePreviewModal"), "Student form still mounts evidence preview");

const bell = read("components/staff/StaffSubmissionBell.tsx");
assert(bell.includes("createPortal"), "Notification bell panel uses createPortal");
assert(bell.includes("getBoundingClientRect"), "Notification bell clamps panel to viewport");
assert(bell.includes("Z_INDEX.dropdown"), "Notification bell uses dropdown z-index");
assert(bell.includes("visualViewport"), "Notification bell respects visualViewport (iOS)");
assert(bell.includes("orientationchange"), "Notification bell repositions on orientation change");
assert(bell.includes("useLayoutEffect"), "Notification bell places panel before paint");
assert(!/useState<CSSProperties>/.test(bell) && !/panelStyle/.test(bell), "Notification bell has no legacy panelStyle state");
assert((bell.match(/createPortal\(/g) || []).length === 1, "Notification bell has single createPortal call");

const globals = read("app/globals.css");
assert(globals.includes("font-size: 16px !important"), "iOS anti-zoom input rule present");
assert(globals.includes("100dvh"), "admin chrome uses dvh");

if (failed > 0) {
  console.error(`\n${failed} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll static UI smoke checks passed");
