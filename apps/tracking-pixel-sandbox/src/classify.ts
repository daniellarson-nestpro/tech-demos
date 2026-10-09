/**
 * Forensics for a single intercepted beacon.
 *
 * Everything here is offline and pure: given the URL the payload *wanted* to
 * fetch plus the shape of the element that asked for it, work out who the
 * beacon reports to and what it would have told them.
 */

export type LeakKind =
  | "email"
  | "email-hash"
  | "uuid"
  | "jwt"
  | "ip"
  | "recipient-id"
  | "campaign-id"
  | "timestamp"
  | "embedded-url";

export interface Leak {
  kind: LeakKind;
  value: string;
  /** Where in the URL it was found, e.g. `query:uid` or `path[2]`. */
  where: string;
  /** How it had to be decoded to become readable, e.g. `base64 -> utf8`. */
  via: string;
  note: string;
}

export interface Vendor {
  name: string;
  category: string;
  confidence: "confirmed" | "likely";
}

export interface PixelShape {
  /** Rendered size if the payload declared one. */
  width?: string;
  height?: string;
  hidden: boolean;
  /** `img`, `css-background`, `iframe`, ... */
  origin: string;
  /** True when the element is invisible-by-construction, i.e. a tracking pixel. */
  isPixel: boolean;
  reasons: string[];
}

export type Severity = "critical" | "high" | "medium" | "low";

export interface Verdict {
  vendor: Vendor | null;
  leaks: Leak[];
  severity: Severity;
  headline: string;
  params: { key: string; value: string; decoded?: string; note?: string }[];
}

/* ------------------------------------------------------------------ vendors */

interface VendorRule {
  name: string;
  category: string;
  hosts?: string[];
  path?: RegExp;
}

/**
 * Host suffixes and path shapes for senders and open-tracking vendors that
 * actually show up in the wild. Matching a host is `confirmed`; matching only
 * a path shape is `likely`.
 */
const VENDORS: VendorRule[] = [
  { name: "Mailchimp", category: "Email marketing", hosts: ["list-manage.com", "mailchi.mp", "mailchimp.com"] },
  { name: "SendGrid (Twilio)", category: "Email delivery", hosts: ["sendgrid.net", "sendgrid.com", "sgrid.io"] },
  { name: "HubSpot", category: "Marketing automation", hosts: ["hubspot.com", "hubspotemail.net", "hs-analytics.net", "hubspotlinks.com"] },
  { name: "Klaviyo", category: "Email marketing", hosts: ["klaviyo.com", "klaviyomail.com", "kmail-lists.com"] },
  { name: "Braze", category: "Customer engagement", hosts: ["braze.com", "braze.eu", "appboy.com"] },
  { name: "Customer.io", category: "Customer engagement", hosts: ["customeriomail.com", "customer.io", "cust.io"] },
  { name: "Marketo (Adobe)", category: "Marketing automation", hosts: ["mktoresp.com", "marketo.com", "mktomail.com"] },
  { name: "Salesforce Marketing Cloud", category: "Marketing automation", hosts: ["exct.net", "exacttarget.com", "et.salesforce.com", "pardot.com"] },
  { name: "Postmark", category: "Transactional email", hosts: ["pstmrk.it", "postmarkapp.com"] },
  { name: "Mailgun", category: "Email delivery", hosts: ["mailgun.org", "mailgun.net", "mailgun.com"] },
  { name: "Amazon SES", category: "Email delivery", hosts: ["amazonses.com", "awstrack.me"] },
  { name: "Mandrill (Mailchimp Transactional)", category: "Transactional email", hosts: ["mandrillapp.com"] },
  { name: "Litmus", category: "Email analytics", hosts: ["emltrk.com", "litmus.com"] },
  { name: "Streak", category: "Read receipts", hosts: ["mailfoogae.appspot.com", "streak.com"] },
  { name: "Mixmax", category: "Read receipts", hosts: ["mixmax.com"] },
  { name: "Yesware", category: "Read receipts", hosts: ["yesware.com", "t.yesware.com"] },
  { name: "Mailtrack", category: "Read receipts", hosts: ["mailtrack.io", "mltrk.io"] },
  { name: "Superhuman", category: "Read receipts", hosts: ["superhuman.com", "r.superhuman.com"] },
  { name: "Bananatag (Staffbase)", category: "Read receipts", hosts: ["bananatag.com", "bl-1.com"] },
  { name: "Outreach", category: "Sales engagement", hosts: ["outreach.io", "outreach-mail.com"] },
  { name: "Salesloft", category: "Sales engagement", hosts: ["salesloft.com", "slfrt.com"] },
  { name: "Intercom", category: "Customer messaging", hosts: ["intercom-mail.com", "intercom.io", "via.intercom.io"] },
  { name: "ActiveCampaign", category: "Email marketing", hosts: ["activehosted.com", "activecampaign.com"] },
  { name: "Constant Contact", category: "Email marketing", hosts: ["rs6.net", "constantcontact.com"] },
  { name: "Brevo (Sendinblue)", category: "Email marketing", hosts: ["sendinblue.com", "brevo.com", "sibautomation.com"] },
  { name: "Iterable", category: "Customer engagement", hosts: ["iterable.com", "links.iterable.com"] },
  { name: "Google Analytics", category: "Web analytics", hosts: ["google-analytics.com", "analytics.google.com"] },
  { name: "Meta (Facebook) Pixel", category: "Ad retargeting", hosts: ["facebook.com", "facebook.net"], path: /\/tr\b/ },
  { name: "DoubleClick (Google Ads)", category: "Ad retargeting", hosts: ["doubleclick.net", "googleadservices.com"] },
  { name: "Microsoft Clarity", category: "Session analytics", hosts: ["clarity.ms"] },
  { name: "Matomo", category: "Web analytics", hosts: ["matomo.cloud"], path: /matomo\.php|piwik\.php/ },
];

/** Path shapes that mean "open tracking" regardless of who is hosting it. */
const TRACKING_PATHS: { re: RegExp; label: string }[] = [
  { re: /\/(open|opens|o)\//i, label: "an /open/ path — canonical open-tracking endpoint" },
  { re: /\/wf\/open/i, label: "a /wf/open endpoint — dedicated open tracking" },
  { re: /\/(pixel|px|p)\.(gif|png|jpg|webp)$/i, label: "a 1-pixel image filename" },
  { re: /\/(track|tracking|trk)\//i, label: "a /track/ path" },
  { re: /\/(beacon|collect|event|imp|impression)\b/i, label: "a beacon/collect endpoint" },
  { re: /\/t\.(gif|png)$/i, label: "t.gif — classic tracker filename" },
  { re: /\.(gif|png)$/i, label: "an image with a query string carrying identifiers" },
];

function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith("." + suffix);
}

export function identifyVendor(url: URL): Vendor | null {
  const host = url.hostname.toLowerCase();
  for (const v of VENDORS) {
    for (const h of v.hosts ?? []) {
      if (hostMatches(host, h)) {
        if (v.path && !v.path.test(url.pathname)) continue;
        return { name: v.name, category: v.category, confidence: "confirmed" };
      }
    }
  }
  for (const v of VENDORS) {
    if (v.path && v.path.test(url.pathname)) {
      return { name: v.name, category: v.category, confidence: "likely" };
    }
  }
  return null;
}

/* ----------------------------------------------------------- leak detection */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const HEX32_RE = /\b[0-9a-f]{32}\b/i;
const HEX40_RE = /\b[0-9a-f]{40}\b/i;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;
const URL_RE = /https?:\/\/[^\s"'<>]+/i;

const PRINTABLE_RE = /^[\x20-\x7e\s]+$/;

interface Decoded {
  value: string;
  via: string;
}

function tryBase64(s: string): string | null {
  // Accept base64url and missing padding, which trackers use constantly.
  const cleaned = s.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
  if (cleaned.length < 8 || cleaned.length % 4 === 1) return null;
  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  try {
    const out = atob(padded);
    if (!out || !PRINTABLE_RE.test(out)) return null;
    // Reject decodes that are just noise: require some structure.
    if (!/[@._:\-\/a-z0-9]/i.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

function tryHexAscii(s: string): string | null {
  if (s.length < 8 || s.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(s)) return null;
  let out = "";
  for (let i = 0; i < s.length; i += 2) out += String.fromCharCode(parseInt(s.slice(i, i + 2), 16));
  return PRINTABLE_RE.test(out) && /[@.a-z]/i.test(out) ? out : null;
}

/**
 * Produce the readable variants of one opaque token, recording how each was
 * reached. Trackers routinely nest url-encode(base64(json)), so recurse a
 * couple of levels.
 */
export function decodeChain(raw: string, depth = 0): Decoded[] {
  const out: Decoded[] = [{ value: raw, via: "raw" }];
  if (depth >= 3 || raw.length > 4096) return out;

  const seen = new Set([raw]);
  const push = (value: string, via: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    for (const nested of decodeChain(value, depth + 1)) {
      const chain = nested.via === "raw" ? via : via + " -> " + nested.via;
      if (!out.some((o) => o.value === nested.value)) out.push({ value: nested.value, via: chain });
    }
  };

  if (/%[0-9a-f]{2}/i.test(raw)) {
    try { push(decodeURIComponent(raw), "url-decode"); } catch { /* malformed escape */ }
  }
  const b64 = tryBase64(raw);
  if (b64) push(b64, "base64");
  const hex = tryHexAscii(raw);
  if (hex) push(hex, "hex");

  // Several vendors glue an encoded identifier between fixed delimiters
  // (Salesforce's `ffcb10-<hex>-fe5e177c7c`), so try the pieces too.
  if (raw.length >= 16 && /[-_.:|]/.test(raw)) {
    for (const part of raw.split(/[-_.:|]/)) {
      if (part.length >= 12) push(part, "segment");
    }
  }

  return out;
}

const CAMPAIGN_KEYS = /^(c|cid|campaign|campaign_id|mid|msg|message_id|j|jb|list|l|e_id|blast)$/i;
const RECIPIENT_KEYS = /^(u|uid|user|user_id|recipient|rcpt|sub|subscriber|contact|p|pid|e|em|eid|hash|h|t|tok|token|id)$/i;

/** `keyHint` is the query key the value came from, when there was one. */
function scan(value: string, where: string, via: string, keyHint?: string): Leak[] {
  const forCampaign = keyHint != null && CAMPAIGN_KEYS.test(keyHint);
  const hashNote = (bits: string, algo: string) =>
    forCampaign
      ? bits + " hex chars — " + algo + ", here keyed to the campaign or message rather than the reader."
      : bits + " hex chars — " + algo + ", in practice of the recipient's address. A hash is a pseudonym, not anonymity: it joins this open to the same person across every list that holds that address.";
  const found: Leak[] = [];
  const email = value.match(EMAIL_RE);
  if (email) {
    found.push({
      kind: "email",
      value: email[0],
      where,
      via,
      note:
        via === "raw"
          ? "The recipient's address travels in cleartext. Loading this image tells the vendor exactly who opened the message."
          : "The recipient's address is obfuscated, not protected. Decoding it is a one-liner, and the vendor learns precisely who opened the message.",
    });
  }
  const jwt = value.match(JWT_RE);
  if (jwt) {
    found.push({ kind: "jwt", value: jwt[0].slice(0, 72), where, via, note: "A signed token — its payload is base64 and readable without the key." });
  }
  const h40 = value.match(HEX40_RE);
  if (h40) {
    found.push({ kind: forCampaign ? "campaign-id" : "email-hash", value: h40[0], where, via, note: hashNote("40", "a SHA-1") });
  }
  const h32 = value.match(HEX32_RE);
  if (h32 && !h40) {
    found.push({ kind: forCampaign ? "campaign-id" : "email-hash", value: h32[0], where, via, note: hashNote("32", "an MD5") });
  }
  const uuid = value.match(UUID_RE);
  if (uuid) {
    found.push({ kind: "uuid", value: uuid[0], where, via, note: "A per-recipient UUID — stable across sends, so it tracks one person over time." });
  }
  const ip = value.match(IPV4_RE);
  if (ip) {
    found.push({ kind: "ip", value: ip[0], where, via, note: "An IP address baked into the beacon, pinning the open to a network." });
  }
  const url = value.match(URL_RE);
  if (url && via !== "raw") {
    found.push({ kind: "embedded-url", value: url[0].slice(0, 120), where, via, note: "A second URL is nested inside this parameter — a redirect chain hidden from view." });
  }
  if (/^\d{10}$|^\d{13}$/.test(value.trim())) {
    found.push({ kind: "timestamp", value: value.trim(), where, via, note: "A unix timestamp — the send time, which the open time is diffed against." });
  }
  return found;
}

/* ------------------------------------------------------------------ verdict */

export function analyzeUrl(rawUrl: string, shape: PixelShape): Verdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { vendor: null, leaks: [], severity: "low", headline: "Unparseable URL", params: [] };
  }

  const vendor = identifyVendor(url);
  const leaks: Leak[] = [];
  const params: Verdict["params"] = [];
  const seenLeak = new Set<string>();

  const record = (ls: Leak[]) => {
    for (const l of ls) {
      const key = l.kind + ":" + l.value;
      if (seenLeak.has(key)) continue;
      seenLeak.add(key);
      leaks.push(l);
    }
  };

  // Query parameters. Note that some endpoints (Salesforce's `open.aspx`
  // among them) carry the identifier as a bare key with no value at all, so
  // the key has to be decoded as well as the value.
  for (const [key, value] of url.searchParams) {
    if (value === "" && key.length >= 10) {
      const keyVariants = decodeChain(key);
      const keyDecoded = keyVariants.find((v) => v.via !== "raw");
      params.push({
        key: "(bare)",
        value: key.length > 160 ? key.slice(0, 160) + "..." : key,
        decoded: keyDecoded ? keyDecoded.value.slice(0, 200) : undefined,
        note: "valueless key — the identifier is the key itself",
      });
      for (const v of keyVariants) record(scan(v.value, "query-key", v.via));
      continue;
    }
    const variants = decodeChain(value);
    const decoded = variants.find((v) => v.via !== "raw");
    let note: string | undefined;
    if (CAMPAIGN_KEYS.test(key)) note = "campaign / message identifier";
    else if (RECIPIENT_KEYS.test(key)) note = "recipient identifier";
    params.push({
      key,
      value: value.length > 160 ? value.slice(0, 160) + "..." : value,
      decoded: decoded ? decoded.value.slice(0, 200) : undefined,
      note,
    });
    for (const v of variants) record(scan(v.value, "query:" + key, v.via, key));
  }

  // Path segments — plenty of vendors put the recipient id in the path.
  const segments = url.pathname.split("/").filter(Boolean);
  segments.forEach((seg, i) => {
    for (const v of decodeChain(seg)) record(scan(v.value, "path[" + i + "]", v.via));
  });

  if (url.hash.length > 1) {
    for (const v of decodeChain(url.hash.slice(1))) record(scan(v.value, "fragment", v.via));
  }

  // Opaque high-entropy identifiers that matched no pattern still identify a person.
  if (leaks.length === 0) {
    const candidates = [...segments, ...[...url.searchParams.values()]];
    const opaque = candidates.find((c) => c.length >= 16 && /^[A-Za-z0-9_\-=.]+$/.test(c) && /\d/.test(c) && /[a-z]/i.test(c));
    if (opaque) {
      record([{
        kind: "recipient-id",
        value: opaque.slice(0, 80),
        where: "url",
        via: "raw",
        note: "A long opaque identifier. It does not need to be readable to work: the vendor holds the table that maps it back to an address.",
      }]);
    }
  }

  const pathHit = TRACKING_PATHS.find((p) => p.re.test(url.pathname));

  // Severity.
  let severity: Severity = "low";
  const hasEmail = leaks.some((l) => l.kind === "email");
  const hasIdentity = leaks.some((l) => l.kind === "email-hash" || l.kind === "uuid" || l.kind === "jwt" || l.kind === "recipient-id");
  if (hasEmail) severity = "critical";
  else if (hasIdentity && (shape.isPixel || vendor || pathHit)) severity = "high";
  else if (hasIdentity || shape.isPixel || vendor || pathHit) severity = "medium";

  // Headline.
  let headline: string;
  const otherKinds = [...new Set(leaks.map((l) => l.kind))];
  if (hasEmail) headline = "Leaks the recipient's email address";
  else if (hasIdentity && vendor) headline = "Reports this open to " + vendor.name;
  else if (hasIdentity) headline = "Carries a per-recipient identifier";
  else if (otherKinds.length) headline = (shape.isPixel ? "Invisible pixel carrying " : "Carries ") + otherKinds.join(" + ");
  else if (shape.isPixel) headline = "Invisible pixel with no identifier";
  else if (vendor) headline = "Remote asset served by " + vendor.name;
  else headline = "Remote asset — no tracking signature";

  if (pathHit && severity !== "low") headline += " (" + pathHit.label + ")";

  return { vendor, leaks, severity, headline, params };
}

/** Decide whether an element is a tracking pixel from its declared geometry. */
export function shapeOf(
  origin: string,
  attrs: { width?: string; height?: string; style?: string; alt?: string | null; hidden?: boolean },
): PixelShape {
  const reasons: string[] = [];
  const style = (attrs.style ?? "").toLowerCase();
  const tiny = (v?: string) => {
    if (v == null) return false;
    const n = parseFloat(v);
    return Number.isFinite(n) && n <= 3;
  };

  if (tiny(attrs.width) && tiny(attrs.height)) reasons.push("declared " + (attrs.width ?? "?") + "x" + (attrs.height ?? "?") + " — too small to see");
  else if (tiny(attrs.width) || tiny(attrs.height)) reasons.push("one dimension collapsed to " + (tiny(attrs.width) ? attrs.width : attrs.height));

  if (/display\s*:\s*none/.test(style)) reasons.push("display:none");
  if (/visibility\s*:\s*hidden/.test(style)) reasons.push("visibility:hidden");
  if (/opacity\s*:\s*0(\.0+)?\b/.test(style)) reasons.push("opacity:0");
  if (/(width|height)\s*:\s*[0-3](px)?\b/.test(style)) reasons.push("CSS-sized to a pixel");
  if (attrs.hidden) reasons.push("hidden attribute");
  if (origin === "css-background") reasons.push("loaded from a CSS background — invisible to the reader and to most HTML scanners");
  if (origin === "img" && attrs.alt === "") reasons.push("empty alt text");

  const isPixel = reasons.length > 0;
  return { width: attrs.width, height: attrs.height, hidden: isPixel, origin, isPixel, reasons };
}
