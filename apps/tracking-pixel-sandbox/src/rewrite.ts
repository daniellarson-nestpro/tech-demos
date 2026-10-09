/**
 * Turns a hostile payload into something safe to render.
 *
 * Two jobs, in this order:
 *   1. every URL that would leave this machine is rewritten to a local
 *      `/trap/:id` collector, and the attempt is registered as a beacon;
 *   2. everything that can execute or navigate is removed outright.
 *
 * The CSP on `/sandbox/:id` is the backstop: if a URL shape is ever missed
 * here, the browser refuses the request rather than quietly making it.
 */

import { shapeOf, type PixelShape } from "./classify.ts";

export interface FoundAsset {
  /** Absolute URL the payload wanted. */
  url: string;
  /** `img`, `css-background`, `iframe`, `link`, `video`, `a-click`, ... */
  origin: string;
  /** Which attribute carried it. */
  attr: string;
  shape: PixelShape;
}

/** Called for each intercepted URL; returns the local path to substitute. */
export type Register = (asset: FoundAsset) => string;

export interface Strip {
  what: string;
  detail: string;
}

export interface RewriteResult {
  html: string;
  strips: Strip[];
}

const CSS_URL_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

/**
 * lol-html hands back attribute values exactly as written, entities and all,
 * so an ordinary `?u=1&amp;e=...` would otherwise be parsed as a parameter
 * literally named `amp;e`. A browser decodes these before requesting, so the
 * sandbox has to as well or the forensics describe a URL nobody would fetch.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", sol: "/", colon: ":", equals: "=",
};

function decodeEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, ref: string) => {
    const lower = ref.toLowerCase();
    try {
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(ref.slice(2), 16));
      if (lower.startsWith("#")) return String.fromCodePoint(parseInt(ref.slice(1), 10));
    } catch {
      return match;
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}
const INERT_SCHEME_RE = /^(data|cid|about|blob):/i;
const ACTIVE_SCHEME_RE = /^(javascript|vbscript|file):/i;

function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^\/\//.test(url);
}

function absolutize(url: string): string {
  return /^\/\//.test(url) ? "https:" + url : url;
}

/* ----------------------------------------------------------------- CSS pass */

const CSS_IMPORT_RE = /@import\s+(['"])([^'"]+)\1/gi;

function rewriteCssUrls(css: string, register: Register, origin: string, strips: Strip[]): string {
  // `@import "https://…";` is valid CSS with no url() for the pass below to see.
  const withImports = css.replace(CSS_IMPORT_RE, (match, quote: string, raw: string) => {
    const url = decodeEntities(raw.trim());
    if (!url || INERT_SCHEME_RE.test(url)) return match;
    if (!isRemote(url)) {
      strips.push({ what: "css-import", detail: "Neutralized a non-absolute @import: " + url.slice(0, 80) });
      return '@import ' + quote + quote;
    }
    const path = register({ url: absolutize(url), origin, attr: "css:@import", shape: shapeOf("css-background", {}) });
    return "@import " + quote + path + quote;
  });

  return withImports.replace(CSS_URL_RE, (match, _q, raw: string) => {
    const url = decodeEntities((raw ?? "").trim());
    if (!url || INERT_SCHEME_RE.test(url)) return match;
    if (!isRemote(url)) {
      strips.push({ what: "css-url", detail: "Neutralized a non-absolute CSS url(): " + url.slice(0, 80) });
      return "url()";
    }
    const abs = absolutize(url);
    // A CSS background is the stealthiest place to hide a pixel: no <img> tag
    // for a scanner to find, and nothing for a reader to notice.
    const path = register({ url: abs, origin, attr: "css:url()", shape: shapeOf("css-background", {}) });
    return "url('" + path + "')";
  });
}

/** `<style>` blocks are pre-processed before the streaming pass. */
function rewriteStyleBlocks(html: string, register: Register, strips: Strip[]): string {
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_m, open: string, body: string, close: string) => {
    return open + rewriteCssUrls(body, register, "css-background", strips) + close;
  });
}

/* ----------------------------------------------------------- element passes */

const URL_ATTRS: Record<string, string[]> = {
  img: ["src", "srcset", "lowsrc", "data-src"],
  image: ["src", "href", "xlink:href"],
  input: ["src"],
  source: ["src", "srcset"],
  video: ["src", "poster"],
  audio: ["src"],
  track: ["src"],
  iframe: ["src"],
  frame: ["src"],
  embed: ["src"],
  object: ["data"],
  link: ["href", "imagesrcset"],
  body: ["background"],
  table: ["background"],
  td: ["background"],
  th: ["background"],
  tr: ["background"],
  div: ["background"],
};

function rewriteSrcset(value: string, register: Register, origin: string, strips: Strip[], shape: PixelShape): string {
  return value
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return null;
      const parts = trimmed.split(/\s+/);
      const url = decodeEntities(parts[0]!);
      const descriptor = parts.slice(1).join(" ");
      if (INERT_SCHEME_RE.test(url)) return trimmed;
      if (!isRemote(url)) {
        strips.push({ what: "srcset", detail: "Dropped a non-absolute srcset candidate: " + url.slice(0, 80) });
        return null;
      }
      const path = register({ url: absolutize(url), origin, attr: "srcset", shape });
      return descriptor ? path + " " + descriptor : path;
    })
    .filter(Boolean)
    .join(", ");
}

export async function sealPayload(rawHtml: string, register: Register): Promise<RewriteResult> {
  const strips: Strip[] = [];
  const pre = rewriteStyleBlocks(rawHtml, register, strips);

  const rewriter = new HTMLRewriter().on("*", {
    element(el) {
      const tag = el.tagName.toLowerCase();

      // --- 1. remove anything that can execute or navigate ------------------
      if (tag === "script") {
        const src = el.getAttribute("src");
        strips.push({ what: "script", detail: src ? "Removed <script src=\"" + src.slice(0, 90) + "\">" : "Removed an inline <script> block" });
        el.remove();
        return;
      }
      if (tag === "meta") {
        const equiv = (el.getAttribute("http-equiv") ?? "").toLowerCase();
        if (equiv === "refresh") {
          strips.push({ what: "meta-refresh", detail: "Removed <meta http-equiv=\"refresh\">: " + (el.getAttribute("content") ?? "").slice(0, 90) });
          el.remove();
          return;
        }
      }
      if ((tag === "iframe" || tag === "frame") && el.hasAttribute("srcdoc")) {
        strips.push({ what: "srcdoc", detail: "Removed an <" + tag + " srcdoc> carrying a nested document" });
        el.removeAttribute("srcdoc");
      }
      if (tag === "base") {
        strips.push({ what: "base", detail: "Removed <base href>, which would have re-pointed every relative URL" });
        el.remove();
        return;
      }
      if (tag === "form") {
        strips.push({ what: "form", detail: "Disarmed a <form> targeting " + (el.getAttribute("action") ?? "(none)").slice(0, 90) });
        el.removeAttribute("action");
        el.removeAttribute("method");
      }

      // Inline event handlers.
      const eventAttrs: string[] = [];
      for (const [name] of el.attributes) {
        if (name.toLowerCase().startsWith("on")) eventAttrs.push(name);
      }
      for (const name of eventAttrs) {
        strips.push({ what: "event-handler", detail: "Removed " + name + "= from <" + tag + ">" });
        el.removeAttribute(name);
      }

      // --- 2. reroute every remote URL --------------------------------------
      const style = el.getAttribute("style");
      if (style && CSS_URL_RE.test(style)) {
        el.setAttribute("style", rewriteCssUrls(style, register, "css-background", strips));
      }

      // Links fire on click rather than on load, so record them without
      // turning them into load-time beacons.
      if (tag === "a") {
        const href = decodeEntities(el.getAttribute("href") ?? "");
        if (href && isRemote(href)) {
          const abs = absolutize(href);
          register({ url: abs, origin: "a-click", attr: "href", shape: shapeOf("a-click", {}) });
          el.setAttribute("href", "#");
          el.setAttribute("data-tps-click-blocked", abs.slice(0, 300));
        } else if (href && ACTIVE_SCHEME_RE.test(href)) {
          strips.push({ what: "href", detail: "Neutralized an active-scheme href: " + href.slice(0, 80) });
          el.setAttribute("href", "#");
        }
        el.removeAttribute("target");
        return;
      }

      const attrs = URL_ATTRS[tag];
      if (!attrs) return;

      const origin =
        tag === "img" || tag === "image" ? "img" : tag === "link" ? "link" : tag === "iframe" || tag === "frame" ? "iframe" : tag;

      // Computed once so every URL-bearing attribute on this element — `src`
      // and each `srcset` candidate alike — is judged on the same geometry.
      const shape =
        origin === "img"
          ? shapeOf("img", {
              width: el.getAttribute("width") ?? undefined,
              height: el.getAttribute("height") ?? undefined,
              style: el.getAttribute("style") ?? undefined,
              alt: el.getAttribute("alt"),
              hidden: el.hasAttribute("hidden"),
            })
          : shapeOf(origin, {
              width: el.getAttribute("width") ?? undefined,
              height: el.getAttribute("height") ?? undefined,
              style: el.getAttribute("style") ?? undefined,
            });

      for (const attr of attrs) {
        const value = decodeEntities(el.getAttribute(attr) ?? "");
        if (!value) continue;

        if (attr === "srcset" || attr === "imagesrcset") {
          el.setAttribute(attr, rewriteSrcset(value, register, origin, strips, shape));
          continue;
        }

        // `data:` images are inert and allowed through so the payload still
        // looks like itself; `data:` anywhere else is removed.
        if (INERT_SCHEME_RE.test(value)) {
          if (tag === "img" && /^data:image\//i.test(value)) continue;
          strips.push({ what: attr, detail: "Removed an inert-scheme " + attr + " on <" + tag + ">: " + value.slice(0, 60) });
          el.removeAttribute(attr);
          continue;
        }

        if (!isRemote(value)) {
          strips.push({ what: attr, detail: "Removed a non-absolute " + attr + " on <" + tag + ">: " + value.slice(0, 80) });
          el.removeAttribute(attr);
          continue;
        }

        const path = register({ url: absolutize(value), origin, attr, shape });
        el.setAttribute(attr, path);
        el.setAttribute("data-tps-sealed", "1");
      }
    },
  });

  const html = await rewriter.transform(new Response(pre)).text();
  return { html, strips };
}
