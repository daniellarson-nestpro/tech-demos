import { expect, test, describe } from "bun:test";
import { analyzeUrl, decodeChain, identifyVendor, shapeOf } from "./classify.ts";

const pixel = shapeOf("img", { width: "1", height: "1", alt: "" });
const plain = shapeOf("img", { width: "600", height: "200", alt: "Hero" });
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const hex = (s: string) => Buffer.from(s, "utf8").toString("hex");

describe("vendor attribution", () => {
  test("matches a host suffix, not a substring", () => {
    expect(identifyVendor(new URL("https://ct.sendgrid.net/wf/open"))?.name).toBe("SendGrid (Twilio)");
    // A lookalike domain must not be attributed to the real vendor.
    expect(identifyVendor(new URL("https://sendgrid.net.evil.test/open"))).toBeNull();
  });

  test("requires the path to match for path-qualified vendors", () => {
    expect(identifyVendor(new URL("https://www.facebook.com/tr?id=1"))?.name).toBe("Meta (Facebook) Pixel");
    expect(identifyVendor(new URL("https://www.facebook.com/groups/x"))?.name).not.toBe("Meta (Facebook) Pixel");
  });
});

describe("decodeChain", () => {
  test("recovers base64 and reports how", () => {
    const got = decodeChain(b64("dana@example.com"));
    expect(got.find((d) => d.value === "dana@example.com")?.via).toBe("base64");
  });

  test("recovers hex", () => {
    expect(decodeChain(hex("dana@example.com")).some((d) => d.value === "dana@example.com")).toBe(true);
  });

  test("peels url-encoding before base64", () => {
    const nested = encodeURIComponent(b64("dana@example.com"));
    const hit = decodeChain(nested).find((d) => d.value === "dana@example.com");
    expect(hit?.via).toContain("base64");
  });

  test("splits delimiter-joined tokens", () => {
    const got = decodeChain("ffcb10-" + hex("dana@example.com") + "-fe5e177c");
    expect(got.some((d) => d.value === "dana@example.com")).toBe(true);
  });
});

describe("analyzeUrl", () => {
  test("flags a plaintext address as critical", () => {
    const v = analyzeUrl("https://trk.example.com/open?e=dana@example.com", pixel);
    expect(v.severity).toBe("critical");
    expect(v.leaks.some((l) => l.kind === "email")).toBe(true);
  });

  test("decodes an obfuscated address out of a query parameter", () => {
    const v = analyzeUrl("https://ct.sendgrid.net/wf/open?upn=" + b64("dana@example.com"), pixel);
    expect(v.vendor?.name).toBe("SendGrid (Twilio)");
    expect(v.leaks.find((l) => l.kind === "email")?.value).toBe("dana@example.com");
  });

  test("reads an identifier carried as a valueless query key", () => {
    const v = analyzeUrl("https://click.exct.net/open.aspx?ffcb10-" + hex("dana@example.com") + "-fe5e&j=1", pixel);
    expect(v.leaks.find((l) => l.kind === "email")?.where).toBe("query-key");
  });

  test("treats a hash as identity but a campaign-keyed hash as campaign metadata", () => {
    const uid = analyzeUrl("https://t.example.com/o?uid=d41d8cd98f00b204e9800998ecf8427e", pixel);
    expect(uid.leaks[0]?.note).toContain("recipient");
    expect(uid.leaks[0]?.kind).toBe("email-hash");
    const mid = analyzeUrl("https://t.example.com/o?mid=d41d8cd98f00b204e9800998ecf8427e", pixel);
    expect(mid.leaks[0]?.note).toContain("campaign");
    expect(mid.leaks[0]?.kind).toBe("campaign-id");
  });

  test("does not cry wolf over an ordinary image", () => {
    const v = analyzeUrl("https://cdn.example.com/campaigns/hero-1200.jpg", plain);
    expect(v.severity).toBe("low");
    expect(v.leaks).toHaveLength(0);
  });

  test("survives a malformed URL", () => {
    expect(analyzeUrl("not a url", pixel).severity).toBe("low");
  });
});

describe("shapeOf", () => {
  test("recognises collapsed dimensions and hidden styling", () => {
    expect(shapeOf("img", { width: "1", height: "1" }).isPixel).toBe(true);
    expect(shapeOf("img", { style: "display:none" }).isPixel).toBe(true);
    expect(shapeOf("css-background", {}).isPixel).toBe(true);
    expect(shapeOf("img", { width: "600", height: "300", alt: "Hero" }).isPixel).toBe(false);
  });
});
