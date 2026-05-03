import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

function resolveChromiumPath(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const cmd of ["chromium", "chromium-browser", "google-chrome", "chrome"]) {
    try {
      const found = execSync(`command -v ${cmd}`, { encoding: "utf8" }).trim();
      if (found && existsSync(found)) return found;
    } catch {
      // not found, try next
    }
  }
  throw new Error(
    "Could not locate a Chromium binary. Install chromium or set CHROMIUM_PATH.",
  );
}

const BASE = process.env.SACCO_BASE_URL ?? "http://localhost:80";
const USERNAME = process.env.SACCO_USERNAME ?? "admin";
const PASSWORD = process.env.SACCO_PASSWORD ?? "NewBeginings@2026!";
const OUT_DIR = resolve(
  import.meta.dirname,
  "../../artifacts/biashara-showcase/public/screens",
);

const SHOTS: { path: string; file: string; waitMs?: number }[] = [
  { path: "/dashboard", file: "dashboard.png", waitMs: 2500 },
  { path: "/loans", file: "loans.png", waitMs: 2500 },
  { path: "/reports", file: "reports.png", waitMs: 2500 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    await page.waitForSelector('input[name="username"], input[type="text"]', {
      timeout: 15000,
    });
    const userSel = (await page.$('input[name="username"]'))
      ? 'input[name="username"]'
      : 'input[type="text"]';
    await page.type(userSel, USERNAME);
    await page.type('input[type="password"]', PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
    console.log("Logged in, current URL:", page.url());

    for (const shot of SHOTS) {
      console.log("Capturing", shot.path);
      await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle2" });
      if (shot.waitMs) await new Promise((r) => setTimeout(r, shot.waitMs));
      const out = resolve(OUT_DIR, shot.file);
      await page.screenshot({ path: out as `${string}.png`, fullPage: false });
      console.log("Saved", out);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
