/* claude-obsidian demo frontend */

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let vaultState = { files: [], links: [] };
let selectedSample = null;
let activeNote = null;
let freshTitles = new Set();

/* ---------------- API ---------------- */

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function loadVault() {
  const data = await api("/api/vault");
  vaultState = data;
  const badge = $("#mode-badge");
  badge.textContent = data.live ? "● live Claude mode" : "● offline demo mode";
  badge.classList.toggle("live", !!data.live);
  renderTree();
  graph.update();
}

async function loadSamples() {
  const samples = await api("/api/samples");
  const wrap = $("#sample-chips");
  wrap.innerHTML = "";
  for (const s of samples) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = s.label;
    chip.onclick = () => {
      selectedSample = s.id;
      $("#source-text").value = "";
      $("#source-title").value = s.title;
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    };
    wrap.appendChild(chip);
  }
}

/* ---------------- Agent run + staged log ---------------- */

const log = $("#agent-log");

function logStage(text) {
  const el = document.createElement("div");
  el.className = "log-stage";
  el.innerHTML = `<span class="spinner">◐</span><span class="check">✓</span> ${text}`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function logItem(html) {
  const el = document.createElement("div");
  el.className = "log-item";
  el.innerHTML = html;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function runAgent() {
  const btn = $("#run-btn");
  const text = $("#source-text").value.trim();
  const payload = text
    ? { text, title: $("#source-title").value.trim() }
    : selectedSample
      ? { sampleId: selectedSample }
      : null;
  if (!payload) {
    log.innerHTML = `<p class="log-empty">Paste some text or pick a sample first.</p>`;
    return;
  }

  btn.disabled = true;
  log.innerHTML = "";
  const readStage = logStage("Reading source…");

  let data;
  try {
    data = await api("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logItem(`<b style="color:#e57373">error:</b> ${esc(String(err.message || err))}`);
    btn.disabled = false;
    return;
  }

  const r = data.result;
  await sleep(700);
  readStage.classList.add("done");
  logItem(`source: <b>${esc(r.sourceTitle)}</b> · mode: <b>${r.mode}</b>`);

  const claimStage = logStage(`Extracting claims…`);
  await sleep(500);
  for (const c of r.claims) {
    logItem(`◦ ${esc(c.length > 110 ? c.slice(0, 110) + "…" : c)}`);
    await sleep(320);
  }
  claimStage.classList.add("done");
  claimStage.innerHTML += ` <b>(${r.claims.length})</b>`;

  const noteStage = logStage("Proposing notes…");
  await sleep(450);
  for (const n of r.proposedNotes) {
    logItem(`📄 <b>${esc(n.folder)}/${esc(n.title)}.md</b> — ${esc(n.reason)}`);
    await sleep(300);
  }
  noteStage.classList.add("done");

  const linkStage = logStage("Suggesting wikilinks…");
  await sleep(450);
  for (const l of r.links) {
    logItem(`🔗 [[${esc(l.from)}]] ⟷ [[${esc(l.to)}]] <span style="opacity:.6">· ${esc(l.reason)}</span>`);
    await sleep(260);
  }
  linkStage.classList.add("done");
  linkStage.innerHTML += ` <b>(${r.links.length})</b>`;

  const fileStage = logStage("Filing into vault…");
  await sleep(500);
  freshTitles = new Set(r.filedNotes.map((f) => f.title));
  vaultState = { ...vaultState, ...data.vault };
  renderTree();
  graph.update();
  for (const f of r.filedNotes) {
    logItem(`💾 ${esc(f.path)} ${f.isNew ? '<span class="new-tag">· new</span>' : "· updated"}`);
    await sleep(280);
  }
  fileStage.classList.add("done");
  logItem(`<b style="color:var(--ok)">done.</b> vault now has ${vaultState.files.length} notes, ${vaultState.links.length} links`);

  openNote(r.sourceTitle);
  btn.disabled = false;
}

/* ---------------- Vault tree ---------------- */

function renderTree() {
  const tree = $("#vault-tree");
  tree.innerHTML = "";
  const folders = new Map();
  for (const f of vaultState.files) {
    const key = f.folder || "vault root";
    if (!folders.has(key)) folders.set(key, []);
    folders.get(key).push(f);
  }
  const order = ["vault root", "concepts", "sources"];
  const keys = [...folders.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  for (const key of keys) {
    const div = document.createElement("div");
    div.className = "tree-folder";
    div.innerHTML = `<div class="folder-name">📁 ${esc(key)}</div>`;
    for (const f of folders.get(key)) {
      const el = document.createElement("div");
      el.className = "tree-file" + (freshTitles.has(f.title) ? " is-new" : "") + (activeNote === f.title ? " active" : "");
      el.innerHTML = `<span class="ficon">📄</span>${esc(f.title)}`;
      el.onclick = () => openNote(f.title);
      div.appendChild(el);
    }
    tree.appendChild(div);
  }
}

/* ---------------- Note viewer (mini markdown renderer) ---------------- */

function renderMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const line of lines) {
    let l = esc(line);
    if (/^> \[!\w+\]/.test(l)) { closeList(); html += `<div class="callout">${inline(l.replace(/^> \[!\w+\]\s*/, ""))}</div>`; continue; }
    if (l.startsWith("> ")) { closeList(); html += `<div class="callout">${inline(l.slice(2))}</div>`; continue; }
    if (l.startsWith("# ")) { closeList(); html += `<h1>${inline(l.slice(2))}</h1>`; continue; }
    if (l.startsWith("## ")) { closeList(); html += `<h2>${inline(l.slice(3))}</h2>`; continue; }
    if (l.startsWith("- ")) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(l.slice(2))}</li>`; continue; }
    if (l.trim() === "") { closeList(); continue; }
    closeList();
    html += `<p>${inline(l)}</p>`;
  }
  closeList();
  return html;
}

function inline(s) {
  return s
    .replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const exists = vaultState.files.some((f) => f.title.toLowerCase() === target.trim().toLowerCase());
      return `<a class="wikilink${exists ? "" : " broken"}" data-target="${target.trim()}">${label || target.trim()}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function openNote(title) {
  const note = vaultState.files.find((f) => f.title.toLowerCase() === title.toLowerCase());
  if (!note) return;
  activeNote = note.title;
  $("#note-path").textContent = note.path;
  $("#note-view").innerHTML = renderMarkdown(note.content);
  renderTree();
  graph.highlight(note.title);
}

$("#note-view").addEventListener("click", (e) => {
  const a = e.target.closest("a.wikilink");
  if (a && !a.classList.contains("broken")) openNote(a.dataset.target);
});

/* ---------------- Force-directed graph ---------------- */

const graph = (() => {
  const svg = $("#graph");
  let nodes = new Map(); // title -> {x,y,vx,vy,el,...}
  let edges = [];
  let running = false;

  function color(f) {
    if (f.folder === "sources") return "var(--source)";
    if (f.seed) return "var(--seed)";
    return "var(--accent)";
  }

  function update() {
    const W = svg.clientWidth || 320;
    const H = svg.clientHeight || 400;
    const kept = new Map();
    for (const f of vaultState.files) {
      const prev = nodes.get(f.title);
      kept.set(f.title, prev ?? {
        x: W / 2 + (Math.random() - 0.5) * 120,
        y: H / 2 + (Math.random() - 0.5) * 120,
        vx: 0, vy: 0,
      });
      kept.get(f.title).file = f;
    }
    nodes = kept;
    edges = vaultState.links.filter((l) => nodes.has(l.from) && nodes.has(l.to));
    draw();
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function draw() {
    svg.innerHTML = "";
    for (const e of edges) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "gedge" + (freshTitles.has(e.from) || freshTitles.has(e.to) ? " fresh" : ""));
      line._e = e;
      svg.appendChild(line);
    }
    for (const [title, n] of nodes) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "gnode" + (freshTitles.has(title) ? " fresh" : ""));
      const deg = edges.filter((e) => e.from === title || e.to === title).length;
      const r = 5 + Math.min(6, deg * 1.2);
      g.innerHTML = `<circle r="${r}" fill="${color(n.file)}"></circle><text dy="${r + 11}" text-anchor="middle">${title.length > 20 ? title.slice(0, 19) + "…" : title}</text>`;
      g.addEventListener("click", () => openNote(title));
      n.el = g;
      n.r = r;
      svg.appendChild(g);
    }
  }

  let cooldown = 0;
  function tick() {
    const W = svg.clientWidth || 320;
    const H = (svg.clientHeight || 400) - 10;
    const arr = [...nodes.values()];
    // repulsion
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 1;
        if (d2 < 40000) {
          const f = 900 / d2;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
    }
    // springs
    for (const e of edges) {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 85) * 0.004;
      a.vx += (dx / d) * f * d * 0.02; a.vy += (dy / d) * f * d * 0.02;
      b.vx -= (dx / d) * f * d * 0.02; b.vy -= (dy / d) * f * d * 0.02;
    }
    // gravity toward center + integrate
    for (const n of arr) {
      n.vx += (W / 2 - n.x) * 0.002;
      n.vy += (H / 2 - n.y) * 0.002;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x = Math.max(16, Math.min(W - 16, n.x + n.vx));
      n.y = Math.max(16, Math.min(H - 24, n.y + n.vy));
      if (n.el) n.el.setAttribute("transform", `translate(${n.x},${n.y})`);
    }
    for (const line of svg.querySelectorAll(".gedge")) {
      const a = nodes.get(line._e.from), b = nodes.get(line._e.to);
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    }
    const energy = arr.reduce((s, n) => s + Math.abs(n.vx) + Math.abs(n.vy), 0);
    if (energy > 0.5 || cooldown++ < 400) requestAnimationFrame(tick);
    else running = false;
  }

  function highlight(title) {
    for (const [t, n] of nodes) {
      if (!n.el) continue;
      n.el.querySelector("circle").setAttribute("stroke", t === title ? "#fff" : "rgba(255,255,255,.25)");
      n.el.querySelector("circle").setAttribute("stroke-width", t === title ? "2.5" : "1");
    }
  }

  return { update, highlight };
})();

/* ---------------- Drag & drop, misc wiring ---------------- */

const dz = $("#drop-zone");
["dragenter", "dragover"].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("dragging"); }));
["dragleave", "drop"].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("dragging"); }));
dz.addEventListener("drop", async (e) => {
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  const text = await file.text();
  $("#source-text").value = text;
  $("#source-title").value = file.name.replace(/\.(md|txt)$/i, "");
  selectedSample = null;
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
});

$("#source-text").addEventListener("input", () => {
  if ($("#source-text").value.trim()) {
    selectedSample = null;
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
  }
});

$("#run-btn").onclick = runAgent;
$("#reset-btn").onclick = async () => {
  const data = await api("/api/reset", { method: "POST" });
  freshTitles = new Set();
  activeNote = null;
  vaultState = { ...vaultState, files: data.files, links: data.links };
  $("#note-path").textContent = "Select a note";
  $("#note-view").innerHTML = `<p class="log-empty">Open a note from the vault tree, or run the agent on a source.</p>`;
  log.innerHTML = `<p class="log-empty">The agent is idle. Drop a source and run it.</p>`;
  renderTree();
  graph.update();
};

/* ---------------- boot ---------------- */
loadVault().then(() => openNote("Home"));
loadSamples();
