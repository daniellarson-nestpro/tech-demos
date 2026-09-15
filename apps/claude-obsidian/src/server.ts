import { Vault } from "./vault";
import { runOfflinePipeline } from "./pipeline";
import { liveAvailable, runLivePipeline } from "./live";
import { samples } from "./samples";

const vault = new Vault();
const PORT = Number(process.env.PORT || 3000);
const publicDir = new URL("../public/", import.meta.url).pathname;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/vault") return json({ ...vault.toJSON(), live: liveAvailable() });

    if (path === "/api/samples") return json(samples.map(({ id, label, title }) => ({ id, label, title })));

    if (path === "/api/reset" && req.method === "POST") {
      vault.reset();
      return json({ ok: true, ...vault.toJSON() });
    }

    if (path === "/api/ingest" && req.method === "POST") {
      const body = (await req.json()) as { text?: string; title?: string; sampleId?: string };
      let text = body.text?.trim() ?? "";
      let title = body.title?.trim() ?? "";
      if (body.sampleId) {
        const s = samples.find((x) => x.id === body.sampleId);
        if (!s) return json({ error: "unknown sample" }, 400);
        text = s.text;
        title = s.title;
      }
      if (!text) return json({ error: "no source text provided" }, 400);
      if (!title) title = text.split(/\s+/).slice(0, 6).join(" ").replace(/[^\w\s-]/g, "") || "Untitled Source";

      let result;
      if (liveAvailable()) {
        try {
          result = await runLivePipeline(text, title, vault);
        } catch (err) {
          console.error("live pipeline failed, falling back to offline:", err);
          result = runOfflinePipeline(text, title, vault);
        }
      } else {
        result = runOfflinePipeline(text, title, vault);
      }
      return json({ result, vault: vault.toJSON() });
    }

    // Static frontend
    const file = Bun.file(publicDir + (path === "/" ? "index.html" : path.slice(1)));
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`claude-obsidian demo running at http://localhost:${server.port} (${liveAvailable() ? "live Claude mode" : "offline demo mode"})`);
