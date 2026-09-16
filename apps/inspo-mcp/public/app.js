const form = document.getElementById("brief-form");
const input = document.getElementById("brief-input");
const board = document.getElementById("board");
const resultsHead = document.getElementById("results-head");
const resultsTitle = document.getElementById("results-title");
const resultsMeta = document.getElementById("results-meta");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  run(input.value.trim());
});

document.getElementById("chips").addEventListener("click", (e) => {
  const brief = e.target.closest(".chip")?.dataset.brief;
  if (!brief) return;
  input.value = brief;
  run(brief);
});

async function run(brief) {
  const res = await fetch(`/api/recommend?q=${encodeURIComponent(brief)}`);
  const data = await res.json();
  render(brief, data);
}

function render(brief, data) {
  resultsHead.hidden = false;
  const anyMatch = data.results.some((r) => r.score > 0);
  resultsTitle.textContent = brief
    ? anyMatch
      ? `Moodboard for “${brief}”`
      : `No close matches — editor's picks instead`
    : "Editor's picks";
  resultsMeta.textContent = `${data.results.length} of ${data.totalScreens} sample screens · offline mode`;

  board.innerHTML = "";
  if (data.results.length === 0) {
    board.innerHTML = `<div class="empty">Nothing in the sample archive matched. Try “dark”, “playful”, “fintech”, “editorial”…</div>`;
    return;
  }

  const maxScore = Math.max(...data.results.map((r) => r.score), 1);
  data.results.forEach((r, i) => {
    const card = buildCard(r, maxScore);
    card.style.animationDelay = `${i * 55}ms`;
    board.appendChild(card);
  });
}

function buildCard(r, maxScore) {
  const [bg, surface, text, accent, accent2] = r.palette;
  const card = el("article", "card");

  // screenshot-style mini mockup
  const shot = el("div", "shot");
  const frame = el("div", "shot-frame");
  frame.style.background = bg;

  const chrome = el("div", "shot-chrome");
  chrome.style.background = surface;
  for (const c of ["#ff5f57", "#febc2e", "#28c840"]) {
    const dot = el("i");
    dot.style.background = c;
    chrome.appendChild(dot);
  }
  const urlBar = el("div", "shot-url");
  urlBar.style.background = bg;
  urlBar.style.color = text;
  urlBar.textContent = r.url;
  chrome.appendChild(urlBar);
  frame.appendChild(chrome);

  const body = el("div", "shot-body");
  body.appendChild(mockup(r, { bg, surface, text, accent, accent2 }));
  frame.appendChild(body);
  shot.appendChild(frame);
  card.appendChild(shot);

  // meta
  const meta = el("div", "card-meta");
  const titleRow = el("div", "card-title-row");
  titleRow.appendChild(el("span", "card-name", r.name));
  titleRow.appendChild(el("span", "card-url", r.url));
  meta.appendChild(titleRow);
  meta.appendChild(el("div", "card-tagline", `${r.tagline} · ${r.layout.replace(/-/g, " ")}`));

  const swatches = el("div", "swatches");
  for (const hex of r.palette) {
    const s = el("div", "swatch");
    s.style.background = hex;
    s.dataset.hex = hex;
    swatches.appendChild(s);
  }
  meta.appendChild(swatches);

  const fonts = el("div", "fonts-row");
  fonts.appendChild(el("span", "f-display", r.fonts.display));
  fonts.appendChild(el("span", "f-sep", "·"));
  fonts.appendChild(el("span", "f-body", r.fonts.body));
  fonts.appendChild(el("span", "f-sep", "—"));
  fonts.appendChild(el("span", null, "display / body"));
  meta.appendChild(fonts);

  const tagRow = el("div", "tag-row");
  const hits = new Set(r.matched);
  for (const t of [...r.tags, r.category]) {
    const tag = el("span", "tag", t);
    // highlight tags related to what the brief matched on
    if ([...hits].some((h) => t.includes(h) || h.includes(t))) tag.classList.add("hit");
    tagRow.appendChild(tag);
  }
  meta.appendChild(tagRow);

  if (r.score > 0) {
    const scoreRow = el("div", "score-row");
    const bar = el("div", "score-bar");
    const fill = el("div", "score-fill");
    fill.style.width = `${Math.round((r.score / maxScore) * 100)}%`;
    bar.appendChild(fill);
    scoreRow.appendChild(bar);
    scoreRow.appendChild(
      el("span", "score-label", r.matched.length ? `matched: ${r.matched.join(", ")}` : "match")
    );
    meta.appendChild(scoreRow);
  }

  card.appendChild(meta);
  return card;
}

/* Build a per-layout CSS mini-mockup from the site's palette. */
function mockup(r, p) {
  const wrap = el("div");
  wrap.style.cssText = "height:100%;display:flex;flex-direction:column;gap:6px;";

  const line = (w, h, color, extra = "") => {
    const d = el("div", "mk-line");
    d.style.cssText = `width:${w};height:${h}px;background:${color};${extra}`;
    return d;
  };
  const box = (color, extra = "") => {
    const d = el("div", "mk-box");
    d.style.cssText = `background:${color};${extra}`;
    return d;
  };

  switch (r.layout) {
    case "marquee-hero": {
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "center";
      wrap.style.textAlign = "center";
      const h = el("div", "mk-headline", r.tagline);
      h.style.cssText += `color:${p.text};font-size:13px;max-width:85%;`;
      wrap.appendChild(h);
      wrap.appendChild(line("45%", 4, p.text, "opacity:.35;"));
      const btn = el("div", "mk-btn");
      btn.style.cssText = `background:${p.accent};width:52px;height:14px;margin-top:2px;`;
      wrap.appendChild(btn);
      const glow = el("div");
      glow.style.cssText = `position:absolute;bottom:-30%;left:20%;right:20%;height:60%;border-radius:50%;filter:blur(18px);opacity:.5;background:linear-gradient(90deg,${p.accent},${p.accent2});`;
      wrap.appendChild(glow);
      break;
    }
    case "bento-grid": {
      wrap.appendChild(line("40%", 8, p.text, "opacity:.9;"));
      const grid = el("div");
      grid.style.cssText = "flex:1;display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1fr 1fr;gap:5px;";
      grid.appendChild(box(p.surface, `border:1px solid ${p.accent}33;grid-row:span 2;`));
      grid.appendChild(box(p.accent, "opacity:.85;"));
      grid.appendChild(box(p.surface, `border:1px solid ${p.accent2}44;`));
      wrap.appendChild(grid);
      break;
    }
    case "split-studio": {
      const row = el("div");
      row.style.cssText = "flex:1;display:flex;gap:8px;align-items:stretch;";
      const left = el("div");
      left.style.cssText = "flex:1;display:flex;flex-direction:column;gap:5px;justify-content:center;";
      const h = el("div", "mk-headline", r.tagline);
      h.style.cssText += `color:${p.text};font-size:10.5px;`;
      left.appendChild(h);
      left.appendChild(line("80%", 3, p.text, "opacity:.35;"));
      left.appendChild(line("65%", 3, p.text, "opacity:.35;"));
      const btn = el("div", "mk-btn");
      btn.style.cssText = `background:${p.accent};width:40px;height:11px;margin-top:3px;`;
      left.appendChild(btn);
      row.appendChild(left);
      row.appendChild(box(`linear-gradient(135deg,${p.accent}cc,${p.accent2}cc)`, "flex:1;"));
      wrap.appendChild(row);
      break;
    }
    case "dashboard": {
      const row = el("div");
      row.style.cssText = "flex:1;display:flex;gap:6px;";
      const side = el("div");
      side.style.cssText = `width:22%;background:${p.surface};border-radius:5px;padding:5px;display:flex;flex-direction:column;gap:4px;`;
      for (let i = 0; i < 4; i++) side.appendChild(line("100%", 4, i === 0 ? p.accent : p.text, i === 0 ? "" : "opacity:.25;"));
      row.appendChild(side);
      const mainCol = el("div");
      mainCol.style.cssText = "flex:1;display:flex;flex-direction:column;gap:5px;";
      const stats = el("div");
      stats.style.cssText = "display:flex;gap:5px;height:26%;";
      for (let i = 0; i < 3; i++) stats.appendChild(box(p.surface, `flex:1;border:1px solid ${p.accent}22;`));
      mainCol.appendChild(stats);
      mainCol.appendChild(box(p.surface, `flex:1;border:1px solid ${p.accent2}22;`));
      row.appendChild(mainCol);
      wrap.appendChild(row);
      break;
    }
    case "editorial": {
      wrap.appendChild(line("30%", 3, p.accent));
      const h = el("div", "mk-headline", r.tagline);
      h.style.cssText += `color:${p.text};font-size:14px;font-style:italic;`;
      wrap.appendChild(h);
      const cols = el("div");
      cols.style.cssText = "flex:1;display:flex;gap:8px;margin-top:2px;";
      for (let i = 0; i < 3; i++) {
        const c = el("div");
        c.style.cssText = "flex:1;display:flex;flex-direction:column;gap:3px;";
        for (let j = 0; j < 4; j++) c.appendChild(line(j === 3 ? "60%" : "100%", 2.5, p.text, "opacity:.3;"));
        cols.appendChild(c);
      }
      wrap.appendChild(cols);
      break;
    }
  }
  return wrap;
}

function el(tag, cls, text) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}

// initial state: show editor's picks so the board isn't empty
run("");
