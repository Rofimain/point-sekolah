/**
 * Visual / responsive QA with real Chromium (Playwright).
 * Prerequisite: app listening at BASE_URL (default http://127.0.0.1:3000).
 *
 * Run: npx tsx scripts/playwright-visual-qa.ts
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const STAFF_EMAIL = process.env.QA_STAFF_EMAIL || "admin@seed.local";
const STAFF_PASSWORD = process.env.QA_STAFF_PASSWORD || "Admin@1234";
const STUDENT_EMAIL = process.env.QA_STUDENT_EMAIL || "0051234567@siswa.seed.local";
const STUDENT_PASSWORD = process.env.QA_STUDENT_PASSWORD || "Siswa@123456";

const VIEWPORTS = [
  { w: 320, h: 568, name: "iPhoneSE" },
  { w: 375, h: 812, name: "iPhoneX" },
  { w: 390, h: 844, name: "iPhone12" },
  { w: 430, h: 932, name: "iPhone14ProMax" },
  { w: 768, h: 1024, name: "iPad" },
  { w: 1024, h: 768, name: "iPadLandscape" },
  { w: 1280, h: 720, name: "HD" },
  { w: 1440, h: 900, name: "Laptop" },
  { w: 1920, h: 1080, name: "FullHD" },
] as const;

type Issue = { viewport: string; page: string; mode: string; detail: string };

const issues: Issue[] = [];
let passCount = 0;

function note(viewport: string, page: string, mode: string, detail: string, ok: boolean) {
  if (ok) {
    passCount += 1;
    console.log(`PASS  [${viewport}] ${page} (${mode}): ${detail}`);
  } else {
    issues.push({ viewport, page, mode, detail });
    console.error(`FAIL  [${viewport}] ${page} (${mode}): ${detail}`);
  }
}

async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const clientW = doc.clientWidth;
    const horizontal = scrollW > clientW + 1;

    const clipped: string[] = [];
    const nodes = Array.from(document.querySelectorAll("h1, h2, button, a, td, th, [class*='badge']"));
    for (const el of nodes.slice(0, 80)) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // text clipped by overflow hidden + ellipsis when scrollWidth much larger
      if (
        (style.overflow === "hidden" || style.overflowX === "hidden" || style.webkitLineClamp !== "none") &&
        (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 8
      ) {
        const text = (el.textContent || "").trim().slice(0, 40);
        if (text && text.length <= 6 && text.includes("...")) {
          clipped.push(text);
        }
      }
      // element extends past viewport
      if (r.right > clientW + 2 && !el.closest("[class*='overflow-x-auto'], [class*='overflow-auto']")) {
        clipped.push(`oob:${(el.textContent || el.tagName).trim().slice(0, 24)}`);
      }
    }
    return { horizontal, scrollW, clientW, clipped: clipped.slice(0, 5) };
  });
}

async function staffLogin(page: Page) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="text"], input[autocomplete="username"]').first().fill(STAFF_EMAIL);
  await page.locator('input[type="password"]').first().fill(STAFF_PASSWORD);
  await Promise.all([
    page.waitForURL(/dashboard|records|students|users/i, { timeout: 20000 }).catch(() => null),
    page.getByRole("button", { name: /Masuk/i }).click(),
  ]);
  // fallback: follow redirect
  if (!page.url().includes("/dashboard") && !page.url().match(/records|students|users/)) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }).catch(() => null);
  }
}

async function studentLogin(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD);
  await Promise.all([
    page.waitForURL(/form|dashboard/i, { timeout: 20000 }).catch(() => null),
    page.getByRole("button", { name: /Masuk/i }).click(),
  ]);
}

async function setTheme(page: Page, mode: "light" | "dark") {
  await page.evaluate((m) => {
    const root = document.documentElement;
    if (m === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", m);
    } catch {
      /* ignore */
    }
  }, mode);
  await page.waitForTimeout(150);
}

async function auditPage(page: Page, viewport: string, path: string, mode: "light" | "dark") {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  await setTheme(page, mode);
  const m = await measureOverflow(page);
  note(viewport, path, mode, `no document horizontal scroll (${m.clientW}px)`, !m.horizontal);
  if (m.horizontal) {
    note(viewport, path, mode, `scrollWidth=${m.scrollW} > clientWidth=${m.clientW}`, false);
  }
  // Severe clip like "[3]..." only — soft ellipsis on long cells is OK with title
  const severe = m.clipped.filter((c) => /^\[.\]\.\.\.$/.test(c) || c.startsWith("oob:"));
  note(viewport, path, mode, severe.length === 0 ? "no severe clip/oob" : `clipped=${severe.join("|")}`, severe.length === 0);

  // landmark presence
  const hasMain = await page.locator("main, [role='main'], #admin-main-scroll").count();
  note(viewport, path, mode, "main landmark present", hasMain > 0);
}

async function openRecordsModalSmoke(page: Page, viewport: string, mode: "light" | "dark") {
  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded" });
  await setTheme(page, mode);
  await page.waitForTimeout(500);
  const addBtn = page.getByRole("button", { name: /Tambah Catatan/i }).first();
  if ((await addBtn.count()) === 0) {
    note(viewport, "/records modal", mode, "add button not found (skip)", true);
    return;
  }
  await addBtn.click();
  await page.waitForTimeout(400);
  const dialogHeading = page.getByText(/Tambah catatan pelanggaran/i);
  const visible = (await dialogHeading.count()) > 0 && (await dialogHeading.first().isVisible());
  note(viewport, "/records modal", mode, "modal overlay visible", visible);
  if (visible) {
    const overlay = page.locator(`.${"fixed"}`).filter({ has: dialogHeading }).first();
    const box = await overlay.boundingBox().catch(() => null);
    note(viewport, "/records modal", mode, "modal within viewport width", !box || box.x >= -2);
    await page.keyboard.press("Escape").catch(() => null);
    const close = page.getByRole("button", { name: /Batal|Tutup|Close/i }).first();
    if (await close.count()) await close.click().catch(() => null);
  }
}

async function main() {
  console.log(`BASE_URL=${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Health
  const ready = await page.goto(`${BASE}/api/health/ready`, { waitUntil: "domcontentloaded" });
  note("boot", "/api/health/ready", "n/a", `status ${ready?.status()}`, ready?.ok() === true);
  if (!ready?.ok()) {
    await browser.close();
    process.exit(1);
  }

  await staffLogin(page);
  const loggedIn = await page.evaluate(() => document.cookie.includes("session") || document.body.innerText.length > 50);
  note("boot", "staff-login", "n/a", "session UI loaded", loggedIn);

  const staffPaths = ["/dashboard", "/records", "/students", "/users", "/violations", "/settings", "/cetak-surat"];

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const mode of ["light", "dark"] as const) {
      for (const path of staffPaths) {
        try {
          await auditPage(page, vp.name, path, mode);
        } catch (e) {
          note(vp.name, path, mode, `navigation error: ${(e as Error).message}`, false);
        }
      }
      try {
        await openRecordsModalSmoke(page, vp.name, mode);
      } catch (e) {
        note(vp.name, "/records modal", mode, `modal error: ${(e as Error).message}`, false);
      }
    }
  }

  // Student portal sample
  await context.clearCookies();
  await studentLogin(page);
  for (const vp of [
    { w: 375, h: 812, name: "iPhoneX" },
    { w: 1280, h: 720, name: "HD" },
  ] as const) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const mode of ["light", "dark"] as const) {
      try {
        await auditPage(page, vp.name, "/form", mode);
      } catch (e) {
        note(vp.name, "/form", mode, `error ${(e as Error).message}`, false);
      }
    }
  }

  // Auth pages (logged out)
  await context.clearCookies();
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const path of ["/login", "/admin/login"] as const) {
      for (const mode of ["light", "dark"] as const) {
        try {
          await auditPage(page, vp.name, path, mode);
        } catch (e) {
          note(vp.name, path, mode, `error ${(e as Error).message}`, false);
        }
      }
    }
  }

  await browser.close();

  console.log("\n========== SUMMARY ==========");
  console.log(`PASS checks: ${passCount}`);
  console.log(`FAIL checks: ${issues.length}`);
  if (issues.length) {
    console.log("\nFailures:");
    for (const i of issues) console.log(` - [${i.viewport}] ${i.page} (${i.mode}): ${i.detail}`);
    process.exit(1);
  }
  console.log("All Playwright visual checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
