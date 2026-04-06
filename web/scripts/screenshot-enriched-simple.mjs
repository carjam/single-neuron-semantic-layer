/**
 * Capture a simplified /enriched screenshot for README.
 * Requires running dev server on port 3000.
 * Usage: node scripts/screenshot-enriched-simple.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outPath = path.join(root, "docs", "images", "enriched-output-simple.png");
const base = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

const keepHeaders = new Set([
  "Observation ID",
  "ISIN",
  "Vendor issuer class",
  "Vendor region",
  "Fund region override",
  "Effective region",
  "Score, outcome 1",
  "Score, outcome 2",
  "Score, outcome 3",
  "Winning workstream",
  "Winning score",
  "Descriptor 01",
  "Descriptor 02",
  "Descriptor 03",
  "Descriptor 04",
]);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1700, height: 950 });
await page.goto(`${base}/enriched`, { waitUntil: "networkidle", timeout: 120000 });
await page.getByRole("heading", { name: "Enriched output" }).waitFor({ timeout: 15000 });
await page.waitForSelector("table", { timeout: 15000 });

await page.evaluate((headersToKeep) => {
  const table = document.querySelector("table");
  if (!table) return;
  const headerCells = Array.from(table.querySelectorAll("thead th"));
  const keepIndices = new Set(
    headerCells
      .map((th, idx) => ({ idx, label: (th.textContent || "").trim() }))
      .filter((x) => headersToKeep.includes(x.label))
      .map((x) => x.idx),
  );

  headerCells.forEach((th, idx) => {
    if (!keepIndices.has(idx)) th.style.display = "none";
  });
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  rows.forEach((tr) => {
    Array.from(tr.children).forEach((cell, idx) => {
      if (!keepIndices.has(idx)) {
        cell.style.display = "none";
      }
    });
  });
}, [...keepHeaders]);

const container = page.locator("div.rounded-lg.border.border-zinc-300.bg-white.shadow-sm");
await container.screenshot({ path: outPath });
await browser.close();
console.log("Wrote", outPath);
