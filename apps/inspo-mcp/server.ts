import { recommend } from "./src/recommend";
import { SCREENS } from "./src/data";

const PORT = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/recommend") {
      const q = url.searchParams.get("q") ?? "";
      const results = recommend(q, 6);
      return Response.json({
        query: q,
        mode: "sample", // offline curated dataset, no live API
        totalScreens: SCREENS.length,
        results: results.map((m) => ({ ...m.screen, score: m.score, matched: m.matched })),
      });
    }

    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`${import.meta.dir}/public${path}`);
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Inspo moodboard demo running at http://localhost:${server.port}`);
