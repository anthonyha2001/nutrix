import "server-only";
import { existsSync } from "node:fs";
import { cookies, headers } from "next/headers";

// Renders the printable plan (/print/plan/[id]) to an A4 PDF in headless
// Chrome, signed in as the staff member asking (their cookies are passed on).
// On Vercel it uses @sparticuz/chromium; locally, Chrome or Playwright's.

const LOCAL_CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

async function launch() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const executablePath = LOCAL_CHROME.find((p) => p && existsSync(p));
  if (!executablePath) throw new Error("No Chrome found for PDFs (set CHROME_PATH).");
  return puppeteer.launch({ executablePath, headless: true });
}

export async function renderPlanPdf(planId: string, lang: "en" | "fr" | "ar") {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const jar = (await cookies()).getAll();

  const browser = await launch();
  try {
    const page = await browser.newPage();
    const { hostname } = new URL(origin);
    await browser.setCookie(...jar.map((c) => ({ name: c.name, value: c.value, domain: hostname, path: "/" })));
    await page.emulateMediaType("print");
    const q = new URLSearchParams({ pdf: "1", ...(lang !== "en" ? { lang } : {}) });
    const res = await page.goto(`${origin}/print/plan/${planId}?${q}`, { waitUntil: "networkidle0", timeout: 30_000 });
    if (!res?.ok()) throw new Error(`Plan page answered ${res?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#8a8f98;text-align:center;font-family:sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// A file name the patient recognises: "Meal plan - Lina Khoury.pdf".
export const planFileName = (planName: string, patientName: string) =>
  `${`${planName} - ${patientName}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)}.pdf`;
