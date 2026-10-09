/**
 * Drives the running sandbox with a real browser to produce the proof
 * artifacts, and asserts the containment guarantee while doing it.
 *
 * The assertion is the important part: every request the browser makes while
 * rendering a payload full of tracker URLs must be to this machine. One
 * request to a vendor host fails the run.
 *
 * Usage:  bun run dev          (in another shell)
 *         bun run capture
 */

import { chromium } from "playwright";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../docs/", import.meta.url).pathname;
const TMP = new URL("../.capture-tmp/", import.meta.url).pathname;
/** The container ships this Chromium; using it directly avoids revision pinning. */
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium";

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const beat = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext({
  // Tall enough that the sealed preview and the beacon log are both fully
  // in frame, so one screenshot carries the whole story.
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
  recordVideo: { dir: TMP, size: { width: 1440, height: 1024 } },
});

/** Every URL the browser requested, main frame and sandboxed iframe alike. */
const requested = [];
context.on("request", (req) => requested.push(req.url()));

const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

async function detonateSample(index) {
  await page.locator(".sample").nth(index).click();
  await beat(500);
  await page.getByRole("button", { name: "Detonate" }).click();
  // Beacons arrive armed, then flip to blocked as the sealed render fetches them.
  await page.waitForFunction(
    () => Number(document.getElementById("s-fired").textContent) > 0,
    null,
    { timeout: 15_000 },
  );
  await beat(1400);
}

console.log("→ loading " + BASE);
await page.goto(BASE, { waitUntil: "networkidle" });
await beat(1200);

console.log("→ detonating the retail newsletter");
await detonateSample(0);

const stats = await page.evaluate(() => ({
  total: document.getElementById("s-total").textContent,
  fired: document.getElementById("s-fired").textContent,
  pixels: document.getElementById("s-pixels").textContent,
  hosts: document.getElementById("s-hosts").textContent,
  leaks: document.getElementById("s-leaks").textContent,
}));
console.log("   stats:", stats);

// Open the stealthiest beacon in the payload: the CSS-background pixel.
console.log("→ inspecting the CSS-background beacon");
await page.locator(".log li", { hasText: "ct.sendgrid.net" }).first().click();
await beat(1800);

await page.screenshot({ path: join(OUT, "screenshot.png") });
console.log("   wrote docs/screenshot.png");

// Scroll the drawer to the captured request headers.
await page.locator("#detail").evaluate((n) => n.scrollTo({ top: n.scrollHeight, behavior: "smooth" }));
await beat(1600);
await page.screenshot({ path: join(OUT, "screenshot-headers.png") });
console.log("   wrote docs/screenshot-headers.png");

await page.locator("#detail").evaluate((n) => n.scrollTo({ top: 0, behavior: "smooth" }));
await beat(700);

console.log("→ filtering to beacons carrying identity");
await page.locator("#only-leaks").check();
await beat(1700);
await page.locator("#only-leaks").uncheck();
await beat(700);

console.log("→ detonating the stealth read receipt");
await page.locator("#detail-close").click();
await beat(400);
await detonateSample(1);
await page.locator(".log li", { hasText: "t.yesware.com" }).first().click();
await beat(2000);
await page.screenshot({ path: join(OUT, "screenshot-stealth.png") });
console.log("   wrote docs/screenshot-stealth.png");
await beat(900);

/* --------------------------------------------------- containment assertion */

const escaped = requested.filter((u) => {
  if (/^(about|data|blob|chrome|devtools):/i.test(u)) return false;
  try {
    const { hostname, port } = new URL(u);
    const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    return !(local && (port === "3000" || port === ""));
  } catch {
    return true;
  }
});

await context.close();
await browser.close();

/* ------------------------------------------------------------ video encode */

const webm = readdirSync(TMP).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("Playwright produced no video.");
const src = join(TMP, webm);

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + args.join(" "));
};

// MP4 for playback, plus a GIF so the run renders inline in the PR. The GIF
// is kept deliberately lean — it is committed to the repository.
ff(["-i", src, "-vf", "scale=1280:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, "demo.mp4")]);
ff([
  "-i", src,
  "-vf", "fps=8,scale=760:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
  "-loop", "0", join(OUT, "demo.gif"),
]);
rmSync(TMP, { recursive: true, force: true });
console.log("   wrote docs/demo.mp4 and docs/demo.gif");

/* ------------------------------------------------------------------ verdict */

const hosts = [...new Set(requested.map((u) => { try { return new URL(u).host; } catch { return u; } }))];
console.log("\n  requests made by the browser: " + requested.length);
console.log("  distinct hosts contacted:    " + hosts.join(", "));

if (consoleErrors.length) {
  console.log("\n  console errors (CSP refusals are expected here):");
  for (const e of [...new Set(consoleErrors)].slice(0, 10)) console.log("    " + e.slice(0, 160));
}

if (escaped.length) {
  console.error("\n  CONTAINMENT FAILED — " + escaped.length + " request(s) left the sandbox:");
  for (const u of [...new Set(escaped)].slice(0, 20)) console.error("    " + u);
  process.exit(1);
}
console.log("\n  CONTAINMENT HELD — every request stayed on " + BASE + "\n");
