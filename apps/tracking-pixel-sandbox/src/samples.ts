/**
 * Built-in payloads to detonate.
 *
 * These are synthetic: the hostnames belong to real vendors so attribution is
 * demonstrable, but no request ever leaves the sandbox, the account ids are
 * invented, and the recipient is fictional.
 */

/** The fictional reader every sample is addressed to. */
export const RECIPIENT = "dana.mercer@northwind-labs.com";

/** Base64 of the recipient — exactly how several vendors carry identity. */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
/** Hex of the recipient — how Salesforce-era endpoints carry it. */
const hex = (s: string) => Buffer.from(s, "utf8").toString("hex");
/** A readable stand-in for a signed token: real JWTs are just base64 too. */
const jwtish = (payload: object) =>
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + Buffer.from(JSON.stringify(payload), "utf8").toString("base64url") + ".s1gnatur3";

export interface Sample {
  id: string;
  name: string;
  blurb: string;
  html: string;
}

const RETAIL = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="600;url=https://northwind-labs.com/newsletter/web-version">
  <script>document.write('<img src="https://metrics.example-cdn.net/j.gif?r='+Math.random()+'">');</script>
  <style>
    body { margin:0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, sans-serif; background:#f4f1ec; color:#23201c; }
    .wrap { max-width: 560px; margin:0 auto; background:#fff; }
    .hero { display:block; width:100%; height:180px; background:#d8cfc2; }
    .pad { padding: 28px 32px; }
    h1 { font-size: 24px; margin:0 0 10px; letter-spacing:-0.3px; }
    p { line-height:1.6; font-size:15px; color:#4a443d; }
    .cta { display:inline-block; background:#1f6f5c; color:#fff; padding:11px 20px; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px; }
    .foot { padding:20px 32px 30px; font-size:12px; color:#8b8377; border-top:1px solid #ece7df; }
    /* The footer "ornament" is a tracking pixel wearing a decoration costume. */
    .ornament { height:4px; background-image:url(https://ct.sendgrid.net/wf/open?upn=${b64(RECIPIENT)}&mid=7c4e9a1b3f6d8e2a5b7c9d1e3f5a7b9c); background-repeat:no-repeat; }
  </style>
</head>
<body>
  <div class="wrap">
    <img class="hero" src="https://cdn.northwind-labs.com/campaigns/autumn/hero-1200.jpg" alt="Autumn collection" width="560" height="180">
    <div class="pad">
      <h1>Your autumn picks are in</h1>
      <p>Hi Dana — we set aside three things we think you'll like, based on what you browsed last week. Free returns through Sunday.</p>
      <p><a class="cta" href="https://northwindlabs.us17.list-manage.com/track/click?u=8f2b1c9d4e&amp;id=4a9e2f71c8&amp;e=${b64(RECIPIENT)}">Shop the collection</a></p>
    </div>
    <div class="ornament"></div>
    <div class="foot">
      You are receiving this because you have an account with Northwind Labs.
      <a href="https://northwindlabs.us17.list-manage.com/unsubscribe?u=8f2b1c9d4e&amp;id=4a9e2f71c8&amp;e=${b64(RECIPIENT)}">Unsubscribe</a>
    </div>
  </div>

  <!-- Open tracking, the conventional stack: sender, then analytics, then ads. -->
  <img src="https://northwindlabs.us17.list-manage.com/track/open.php?u=8f2b1c9d4e&amp;id=4a9e2f71c8&amp;e=${b64(RECIPIENT)}" width="1" height="1" alt="" style="display:none">
  <img src="https://www.google-analytics.com/collect?v=1&amp;tid=UA-18422-3&amp;cid=f47ac10b-58cc-4372-a567-0e02b2c3d479&amp;t=event&amp;ec=email&amp;ea=open&amp;cm=email&amp;cn=autumn-2026" width="1" height="1" alt="">
  <img src="https://www.facebook.com/tr?id=991827364554&amp;ev=EmailOpen&amp;noscript=1&amp;eid=${b64(RECIPIENT)}" height="1" width="1" style="display:none" alt="">
  <img src="https://trk.klaviyo.com/open?_kx=${b64(RECIPIENT)}&amp;m=01JF8QZ4R7KXNC2VBD9MTY3H6E" width="1" height="1" alt="">
</body>
</html>`;

const STEALTH = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; font-size:15px; line-height:1.65; color:#1b1b1b; background:#fff; max-width:580px; margin:0 auto; padding:34px 30px; }
    .sig { margin-top:26px; color:#555; font-size:13px; border-top:1px solid #e6e6e6; padding-top:14px; }
    /* No <img> tag anywhere near this. The beacon is a decoration on a rule. */
    .sig::after { content:''; display:block; width:1px; height:1px; overflow:hidden;
      background-image:url(https://t.yesware.com/t/${hex("open")}/dd9f2e41-7c0b-4ab6-9f3e-6c1d2a8b4e57/spacer.gif); }
    .spacer { width:1px; height:1px; }
  </style>
</head>
<body>
  <p>Hi Dana,</p>
  <p>Thanks for making time yesterday. Summarising what we agreed so nothing drifts:</p>
  <ol>
    <li>You send the Q3 reconciliation by Thursday.</li>
    <li>We hold the pilot scope at two regions.</li>
    <li>I'll book the follow-up for the week of the 20th.</li>
  </ol>
  <p>Shout if I've mangled any of that.</p>
  <div class="sig">
    Marcus Oyelaran<br>Partnerships, Calder &amp; Vane
  </div>

  <!-- Read receipt, the quiet kind. Zero-sized, no alt, three vendors deep. -->
  <img class="spacer" srcset="https://zz.emltrk.com/${hex(RECIPIENT)}?d=1 1x, https://zz.emltrk.com/${hex(RECIPIENT)}?d=2 2x" alt="">
  <img src="https://mailfoogae.appspot.com/t?sender=${b64(RECIPIENT)}&amp;type=zerocontent&amp;guid=9c84a1f0-3b2e-4d56-8a7f-1e9b0c2d3a4b" width="0" height="0" alt="">
  <div background="https://pstmrk.it/open/${b64(RECIPIENT)}/9f81" style="width:1px;height:1px"></div>
  <img src="https://track.customeriomail.com/e/o/${jwtish({ sub: RECIPIENT, cid: "01JF8QZ4R7", iat: 1791590400 })}" style="display:none" alt="">
</body>
</html>`;

const INVOICE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Helvetica, Arial, sans-serif; background:#eef1f5; margin:0; padding:24px; color:#1c2330; }
    .card { max-width:540px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(20,30,50,.12); }
    .bar { background:#15325c; color:#fff; padding:16px 26px; font-weight:700; letter-spacing:.2px; }
    .body { padding:24px 26px 28px; font-size:14px; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; }
    td { padding:9px 0; border-bottom:1px solid #eaeef3; }
    .total td { font-weight:700; border-bottom:none; }
    .btn { display:inline-block; background:#15325c; color:#fff; padding:10px 18px; border-radius:5px; text-decoration:none; font-size:13px; font-weight:600; }
    .fine { font-size:11px; color:#8e98a8; padding:0 26px 22px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bar">Invoice NW-20461</div>
    <div class="body">
      <p>Hello Dana,</p>
      <p>Your October invoice is ready. Payment is due on the 24th.</p>
      <table>
        <tr><td>Platform subscription</td><td align="right">$1,840.00</td></tr>
        <tr><td>Overage (41k events)</td><td align="right">$212.50</td></tr>
        <tr class="total"><td>Total due</td><td align="right">$2,052.50</td></tr>
      </table>
      <p><a class="btn" href="https://click.exct.net/?qs=${hex("pay")}9a2f&amp;r=${b64("https://billing.northwind-labs.com/pay/NW-20461")}">View and pay invoice</a></p>
    </div>
    <div class="fine">Northwind Labs Ltd · This mailbox is not monitored.</div>
  </div>

  <!-- Enterprise-suite tracking: hex identity, a nested redirect, an iframe beacon. -->
  <img src="https://click.exct.net/open.aspx?ffcb10-${hex(RECIPIENT)}-fe5e177c7c&amp;j=20461&amp;l=84_HTML" width="1" height="1" alt="">
  <img src="https://o1.ptr.awstrack.me/L0/${b64("https://billing.northwind-labs.com/open?inv=NW-20461")}/1/0100019a2f4c/${b64(RECIPIENT)}" width="1" height="1" alt="">
  <img src="https://mandrillapp.com/track/open.php?u=30491847&amp;id=5f2a&amp;ip=203.0.113.47" width="1" height="1" alt="">
  <iframe src="https://beacon.marketo.mktoresp.com/webevents/visitWebPage?pageURL=invoice&amp;mkt_tok=${b64(RECIPIENT)}" width="1" height="1" frameborder="0" style="display:none"></iframe>
</body>
</html>`;

export const SAMPLES: Sample[] = [
  {
    id: "retail-newsletter",
    name: "Retail newsletter",
    blurb: "Looks ordinary. Four open-tracking pixels, a CSS-background fifth, click-wrapped links, an inline script and a meta refresh.",
    html: RETAIL,
  },
  {
    id: "stealth-receipt",
    name: "Stealth read receipt",
    blurb: "A plain note from a colleague. The only beacons are a ::after CSS background, a srcset pair and two zero-sized images.",
    html: STEALTH,
  },
  {
    id: "invoice",
    name: "Enterprise invoice",
    blurb: "Hex-encoded identity in a path, a nested redirect URL, a sender IP in the clear, and an iframe beacon.",
    html: INVOICE,
  },
];

export function sampleById(id: string): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}

/** A bare pixel URL pasted into the URL field becomes a minimal payload. */
export function payloadForUrl(url: string): string {
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;color:#1c1c1c;padding:28px;font-size:13px;line-height:1.7}
.k{color:#8a8a8a}.u{word-break:break-all;color:#0b5fff}
</style></head><body>
<p class="k">Single-asset payload. The sandbox requested the URL below; nothing left this machine.</p>
<p class="u">${escaped}</p>
<img src="${escaped}" alt="">
</body></html>`;
}
