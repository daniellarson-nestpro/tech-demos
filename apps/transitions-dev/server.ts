const PORT = Number(process.env.PORT ?? 3000);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (path.includes("..")) return new Response("Bad request", { status: 400 });

    const file = Bun.file(import.meta.dir + "/public" + path);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });

    const ext = path.slice(path.lastIndexOf("."));
    return new Response(file, {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream" },
    });
  },
});

console.log(`transitions gallery running at http://localhost:${PORT}`);
