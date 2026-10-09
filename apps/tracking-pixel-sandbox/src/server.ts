/**
 * Tracking Pixel Sandbox — hermetic detonation chamber for email beacons.
 *
 * The only route that can reach the network is none of them. Payloads are
 * rewritten so every remote URL points at `/trap/:id`, served under a CSP that
 * forbids anything else, and rendered in a scripts-off iframe. The collector
 * answers locally and forwards nothing, ever.
 */

import { analyzeUrl } from "./classify.ts";
import { sealPayload } from "./rewrite.ts";
import { payloadForUrl, sampleById, SAMPLES } from "./samples.ts";
import { addBeacon, announce, createSession, getSession, recordHit, subscribe, summarize } from "./store.ts";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC = new URL("../public/", import.meta.url).pathname;

/** 1×1 transparent GIF — the same bytes a real tracker would have returned. */
const PIXEL_GIF = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

/**
 * Backstop for the rewriter. `default-src 'none'` means a URL shape the
 * rewriter failed to catch is refused by the browser rather than silently
 * fetched, so a miss in rewrite.ts degrades to a blocked request, not a leak.
 */
const SANDBOX_CSP = [
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "media-src 'self'",
  "frame-src 'self'",
  "script-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function asset(name: string, type: string): Response {
  return new Response(Bun.file(PUBLIC + name), {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}

/** Build a sealed session from raw payload HTML. */
async function detonate(html: string, label: string) {
  const session = createSession(label, new TextEncoder().encode(html).byteLength);

  const sealed = await sealPayload(html, (found) => {
    const verdict = analyzeUrl(found.url, found.shape);
    const beacon = addBeacon(session, {
      url: found.url,
      origin: found.origin,
      attr: found.attr,
      shape: found.shape,
      verdict,
      state: found.origin === "a-click" ? "click-armed" : "armed",
    });
    return "/trap/" + beacon.id;
  });

  session.sealedHtml = sealed.html;
  session.strips = sealed.strips;
  announce(session);
  return session;
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 0,

  routes: {
    "/": () => asset("index.html", "text/html; charset=utf-8"),
    "/app.js": () => asset("app.js", "text/javascript; charset=utf-8"),
    "/styles.css": () => asset("styles.css", "text/css; charset=utf-8"),

    "/api/samples": () =>
      json(SAMPLES.map(({ id, name, blurb }) => ({ id, name, blurb }))),

    "/api/analyze": {
      POST: async (req: Request) => {
        let body: { source?: string; sampleId?: string; html?: string; url?: string };
        try {
          body = (await req.json()) as typeof body;
        } catch {
          return json({ error: "Body must be JSON." }, 400);
        }

        let html: string;
        let label: string;

        if (body.source === "sample") {
          const sample = sampleById(body.sampleId ?? "");
          if (!sample) return json({ error: "Unknown sample." }, 400);
          html = sample.html;
          label = sample.name;
        } else if (body.source === "url") {
          const raw = (body.url ?? "").trim();
          if (!raw) return json({ error: "Enter a pixel URL." }, 400);
          let parsed: URL;
          try {
            parsed = new URL(raw);
          } catch {
            return json({ error: "That is not a valid absolute URL." }, 400);
          }
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return json({ error: "Only http(s) URLs can be analyzed." }, 400);
          }
          html = payloadForUrl(parsed.toString());
          label = "URL — " + parsed.hostname;
        } else {
          html = body.html ?? "";
          if (!html.trim()) return json({ error: "Paste some HTML to analyze." }, 400);
          if (html.length > 2_000_000) return json({ error: "Payload is larger than 2 MB." }, 413);
          label = "Pasted HTML";
        }

        const session = await detonate(html, label);
        return json(summarize(session));
      },
    },

    "/api/session/:id": (req: Bun.BunRequest<"/api/session/:id">) => {
      const session = getSession(req.params.id);
      return session ? json(summarize(session)) : json({ error: "No such session." }, 404);
    },

    // Live beacon feed.
    "/api/events": () => {
      let unsubscribe = () => {};
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (chunk: string) => {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              unsubscribe();
            }
          };
          send(": connected\n\n");
          const off = subscribe((event) => send("data: " + JSON.stringify(event) + "\n\n"));
          const keepalive = setInterval(() => send(": keepalive\n\n"), 20_000);
          unsubscribe = () => {
            clearInterval(keepalive);
            off();
          };
        },
        cancel() {
          unsubscribe();
        },
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    },

    // The sealed render target. Framed by the UI; scripts already stripped.
    "/sandbox/:id": (req: Bun.BunRequest<"/sandbox/:id">) => {
      const session = getSession(req.params.id);
      if (!session) return new Response("No such sandbox session.", { status: 404 });
      return new Response(session.sealedHtml, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": SANDBOX_CSP,
          "referrer-policy": "no-referrer",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    },

    /**
     * The collector. Records the attempt, answers with inert local bytes, and
     * forwards nothing. There is deliberately no code path from here to the
     * network: a sandbox that can phone home is not a sandbox.
     */
    "/trap/:id": (req: Bun.BunRequest<"/trap/:id">) => {
      const beacon = recordHit(req.params.id, req.headers);
      const headers: Record<string, string> = {
        "cache-control": "no-store, no-cache, must-revalidate",
        "x-tps-blocked": "1",
        "timing-allow-origin": "null",
      };
      // Stylesheets must answer as CSS or the browser logs a type error on top
      // of the block; everything else gets the classic 1×1 GIF.
      if (beacon?.origin === "link") {
        return new Response("/* blocked by tracking-pixel-sandbox */\n", {
          headers: { ...headers, "content-type": "text/css" },
        });
      }
      return new Response(PIXEL_GIF, { headers: { ...headers, "content-type": "image/gif" } });
    },
  },

  fetch: () => new Response("Not found", { status: 404 }),
});

console.log("\n  Tracking Pixel Sandbox");
console.log("  http://localhost:" + server.port);
console.log("  egress: default-deny — the collector never forwards\n");
