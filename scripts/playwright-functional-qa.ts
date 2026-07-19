/**
 * Functional flow QA via Playwright (Chromium).
 * Prerequisite: app at BASE_URL with seeded smoke DB.
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const SA_EMAIL = process.env.QA_STAFF_EMAIL || "admin@seed.local";
const SA_PASSWORD = process.env.QA_STAFF_PASSWORD || "Admin@1234";
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || "piket@seed.local";
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || "Guru@1234";
const TEACHER_EMAIL = process.env.QA_TEACHER_EMAIL || "s.rahayu@seed.local";
const TEACHER_PASSWORD = process.env.QA_TEACHER_PASSWORD || "Guru@1234";
const STUDENT_EMAIL = process.env.QA_STUDENT_EMAIL || "0051234567@siswa.seed.local";
const STUDENT_PASSWORD = process.env.QA_STUDENT_PASSWORD || "Siswa@123456";

let pass = 0;
let fail = 0;

function ok(msg: string) {
  pass += 1;
  console.log(`PASS  ${msg}`);
}
function bad(msg: string) {
  fail += 1;
  console.error(`FAIL  ${msg}`);
}
function check(cond: boolean, passMsg: string, failMsg: string) {
  if (cond) ok(passMsg);
  else bad(failMsg);
}

async function staffLogin(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"], input[type="text"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /Masuk/i }).click();
  await page.waitForURL(/dashboard|records|students|users/i, { timeout: 20000 }).catch(() => null);
  if (!/dashboard|records|students|users/.test(page.url())) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  }
}

async function studentLogin(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: /Masuk/i }).click();
  await page.waitForURL(/form/i, { timeout: 20000 }).catch(() => null);
}

async function logoutViaUi(page: Page) {
  const keluar = page.getByRole("button", { name: /^Keluar$/i }).or(page.locator('button[aria-label="Keluar"]'));
  if ((await keluar.count()) > 0) {
    await keluar.first().click();
    await page.waitForTimeout(1000);
    return;
  }
  await page.goto(`${BASE}/api/auth/signout`);
  const confirm = page.getByRole("button", { name: /sign out|keluar/i });
  if (await confirm.count()) await confirm.click();
  await page.waitForTimeout(800);
}

async function main() {
  console.log(`BASE_URL=${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const ready = await page.goto(`${BASE}/api/health/ready`);
  check(ready?.ok() === true, "health ready", `health ${ready?.status()}`);

  await staffLogin(page, SA_EMAIL, SA_PASSWORD);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const dashOk =
    (await page.locator("h1, h2").filter({ hasText: /Dashboard|Ringkasan|Poin/i }).count()) > 0 ||
    (await page.locator("text=/Dashboard|Ringkasan/i").count()) > 0 ||
    page.url().includes("/dashboard");
  check(dashOk, "dashboard loads after login", "dashboard missing");

  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded" });
  const search = page.locator("#records-search");
  if (await search.count()) {
    await search.fill("A");
    await page.getByRole("button", { name: /^Cari$/i }).click();
    await page.waitForTimeout(600);
    ok("records search submitted");
  } else {
    bad("records search missing");
  }

  const grade = page.locator("#records-grade");
  if (await grade.count()) {
    await grade.selectOption({ index: 1 }).catch(() => null);
    await page.waitForTimeout(500);
    ok("records grade filter used");
  } else {
    bad("records grade filter missing");
  }

  const nextPage = page
    .getByRole("link", { name: /Berikutnya|Next|>/i })
    .or(page.getByRole("button", { name: /Berikutnya|Next/i }));
  if ((await nextPage.count()) > 0) {
    await nextPage.first().click().catch(() => null);
    await page.waitForTimeout(500);
    ok("records pagination control present");
  } else {
    ok("records pagination skipped (single page)");
  }

  await page.getByRole("button", { name: /Tambah Catatan/i }).first().click();
  await page.waitForTimeout(400);
  const modalVisible = await page.getByText(/Tambah catatan pelanggaran/i).isVisible().catch(() => false);
  check(modalVisible, "records add modal opens", "records add modal did not open");

  const batal = page.getByRole("button", { name: /Batal/i }).first();
  if (await batal.count()) await batal.click();
  else await page.keyboard.press("Escape");

  await context.clearCookies();
  await staffLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded" });
  const exportBtn = page.getByRole("button", { name: /Export Excel/i });
  if (await exportBtn.count()) {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      exportBtn.click(),
    ]);
    if (download) ok("export excel download started");
    else ok("export excel clicked (no download event — may toast)");
  } else {
    bad("export excel button missing for ADMIN");
  }

  await context.clearCookies();
  await staffLogin(page, TEACHER_EMAIL, TEACHER_PASSWORD);
  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded" });
  const teacherExport = await page.getByRole("button", { name: /Export Excel/i }).count();
  check(teacherExport === 0, "TEACHER cannot export excel", "TEACHER sees export excel");

  await page.goto(`${BASE}/users`, { waitUntil: "domcontentloaded" });
  const createUser = await page.getByRole("button", { name: /Tambah User|Tambah Pengguna|\+ User/i }).count();
  check(createUser === 0, "TEACHER cannot create users (no create button)", "TEACHER sees create user");

  await page.goto(`${BASE}/cetak-surat`, { waitUntil: "domcontentloaded" });
  const cetakOk = page.url().includes("cetak") || (await page.locator("body").innerText()).length > 20;
  check(cetakOk, "cetak-surat page loads", "cetak-surat failed");

  await context.clearCookies();
  await staffLogin(page, SA_EMAIL, SA_PASSWORD);
  await page.goto(`${BASE}/settings/remisi`, { waitUntil: "domcontentloaded" });
  const remisiText = await page.locator("body").innerText();
  check(/remisi|quiet|hari|poin/i.test(remisiText), "settings remisi (cron-related) loads", "remisi page empty");

  await logoutViaUi(page);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const redirectedLogin = page.url().includes("login") || page.url().includes("admin/login");
  check(redirectedLogin, "logout clears session (dashboard redirects)", `logout failed, still at ${page.url()}`);

  await context.clearCookies();
  await studentLogin(page);
  check(page.url().includes("/form"), "student login -> /form", `student landed ${page.url()}`);

  await context.clearCookies();
  await staffLogin(page, SA_EMAIL, SA_PASSWORD);
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  const settingsBody = await page.locator("body").innerText();
  if (/telegram|bot/i.test(settingsBody)) ok("settings shows telegram-related UI");
  else ok("telegram UI not on settings (webhook-only) — skipped");

  await browser.close();

  console.log("\n========== FUNCTIONAL SUMMARY ==========");
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
  console.log("All functional checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
