/**
 * Adversarial check on the containment model.
 *
 * Feeds the sandbox a payload built entirely of awkward URL shapes — the ones
 * a naive `src`/`href` rewriter misses — then renders it in a real browser and
 * asserts that nothing reached the network.
 *
 * This is the test that earns the claim in the README. It caught
 * `<link rel=preload imagesrcset>` slipping past the rewriter, which the CSP
 * then had to catch; both layers are checked here.
 *
 * Usage:  bun run dev        (in another shell)
 *         bun run probe
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium";

/** Each entry is a URL shape; the hostname records which one it is. */
const PAYLOAD = `<!doctype html>
<html>
<head>
  <style>
    @import url("https://css-import-url.evil.test/a.css");
    @import "https://css-import-string.evil.test/b.css";
    @font-face { font-family: x; src: url(https://css-fontface.evil.test/f.woff2); }
    .bg { background-image: url('https://css-background.evil.test/p.gif'); }
  </style>
  <link rel="preload" as="image" imagesrcset="https://link-imagesrcset.evil.test/p.gif 1x, https://link-imagesrcset2.evil.test/p.gif 2x">
  <link rel="stylesheet" href="https://link-stylesheet.evil.test/s.css">
</head>
<body>
  <div class="bg"></div>
  <div style="background:image-set(url('https://style-imageset.evil.test/p.gif') 1x)"></div>
  <div background="https://attr-background.evil.test/p.gif"></div>
  <img src="https://img-src.evil.test/p.gif" width="1" height="1" alt="">
  <img srcset="https://img-srcset.evil.test/p.gif 1x" alt="">
  <input type="image" src="https://input-image.evil.test/p.gif">
  <video poster="https://video-poster.evil.test/p.jpg"><source src="https://video-source.evil.test/v.mp4"></video>
  <audio src="https://audio-src.evil.test/a.mp3"></audio>
  <object data="https://object-data.evil.test/x.swf"></object>
  <embed src="https://embed-src.evil.test/x.swf">
  <iframe src="https://iframe-src.evil.test/f.html"></iframe>
  <iframe srcdoc='<img src="https://iframe-srcdoc.evil.test/p.gif">'></iframe>
  <svg><image href="https://svg-href.evil.test/p.gif" width="1" height="1"/></svg>
  <table background="https://table-background.evil.test/p.gif"><tr><td background="https://td-background.evil.test/p.gif">x</td></tr></table>
  <script src="https://script-src.evil.test/s.js"></script>
  <meta http-equiv="refresh" content="0;url=https://meta-refresh.evil.test/go">
</body>
</html>`;

const analyzed = await fetch(BASE + "/api/analyze", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ source: "html", html: PAYLOAD }),
});
if (!analyzed.ok) throw new Error("analyze failed: " + (await analyzed.text()));
const session = await analyzed.json();

const caught = new Set(session.beacons.map((b) => b.host));
console.log("rewriter intercepted " + caught.size + " shapes:");
for (const h of [...caught].sort()) console.log("  " + h);
console.log("\nstripped outright: " + session.strips.length);
for (const s of session.strips) console.log("  " + s.detail.slice(0, 110));

const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext();
const requested = [];
context.on("request", (req) => requested.push(req.url()));
const page = await context.newPage();
const refusals = [];
page.on("console", (m) => {
  if (m.type() === "error" && /Content Security Policy/i.test(m.text())) refusals.push(m.text());
});

await page.goto(BASE + "/sandbox/" + session.id, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 2500));
await browser.close();

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

console.log("\nCSP refusals (the backstop doing its job): " + refusals.length);
console.log("requests attempted: " + requested.length);

if (escaped.length) {
  console.error("\nPROBE FAILED — " + escaped.length + " request(s) reached a non-local host:");
  for (const u of [...new Set(escaped)]) console.error("  " + u);
  process.exit(1);
}
console.log("\nPROBE PASSED — not one of these shapes reached the network.\n");
