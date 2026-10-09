/**
 * UI for the sandbox. Three jobs: submit a payload, frame the sealed render,
 * and keep the beacon log live off the server's SSE stream.
 */

const $ = (id) => document.getElementById(id);

const el = {
  samples: $("samples"),
  htmlInput: $("html-input"),
  urlInput: $("url-input"),
  detonate: $("detonate"),
  refire: $("refire"),
  error: $("error"),
  stage: $("stage"),
  stageEmpty: $("stage-empty"),
  sealDetail: $("seal-detail"),
  stripsBox: $("strips-box"),
  stripsSummary: $("strips-summary"),
  strips: $("strips"),
  log: $("log"),
  logEmpty: $("log-empty"),
  detail: $("detail"),
  detailTitle: $("detail-title"),
  detailBody: $("detail-body"),
  sessionTag: $("session-tag"),
  onlyLeaks: $("only-leaks"),
  statLeaks: $("stat-leaks"),
};

const state = {
  source: "sample",
  sampleId: null,
  session: null,
  /** id -> beacon */
  beacons: new Map(),
  selected: null,
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* -------------------------------------------------------------------- tabs */

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    for (const t of document.querySelectorAll(".tab")) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
    state.source = tab.id.replace("tab-", "");
  });
}

/* ----------------------------------------------------------------- samples */

const res = await fetch("/api/samples");
for (const s of await res.json()) {
  const b = document.createElement("button");
  b.className = "sample";
  b.type = "button";
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<b>${esc(s.name)}</b><i>${esc(s.blurb)}</i>`;
  b.addEventListener("click", () => {
    state.sampleId = s.id;
    for (const o of el.samples.children) o.setAttribute("aria-pressed", String(o === b));
  });
  el.samples.append(b);
}
el.samples.firstElementChild?.click();

/* ---------------------------------------------------------------- detonate */

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = !message;
}

async function detonate() {
  showError("");
  const body = { source: state.source };
  if (state.source === "sample") {
    if (!state.sampleId) return showError("Pick a sample first.");
    body.sampleId = state.sampleId;
  } else if (state.source === "url") {
    body.url = el.urlInput.value;
  } else {
    body.html = el.htmlInput.value;
  }

  el.detonate.disabled = true;
  el.detonate.textContent = "Sealing…";
  try {
    const r = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return showError(data.error ?? "Analysis failed.");
    loadSession(data);
  } catch (e) {
    showError("Could not reach the sandbox server: " + e.message);
  } finally {
    el.detonate.disabled = false;
    el.detonate.textContent = "Detonate";
  }
}

el.detonate.addEventListener("click", detonate);
el.refire.addEventListener("click", () => {
  if (state.session) el.stage.src = "/sandbox/" + state.session.id + "?t=" + Date.now();
});

function loadSession(session) {
  state.session = session;
  state.beacons = new Map(session.beacons.map((b) => [b.id, b]));
  state.selected = null;
  el.detail.hidden = true;

  el.sessionTag.textContent = session.label + " · " + (session.sourceBytes / 1024).toFixed(1) + " KB · #" + session.id;
  el.sealDetail.textContent =
    session.beacons.length +
    " remote URL" + (session.beacons.length === 1 ? "" : "s") +
    " rerouted · scripts stripped · CSP default-src 'none'";

  // Strips.
  if (session.strips.length) {
    el.stripsBox.hidden = false;
    el.stripsSummary.textContent = "Active content removed (" + session.strips.length + ")";
    el.strips.innerHTML = session.strips.map((s) => `<li>${esc(s.detail)}</li>`).join("");
  } else {
    el.stripsBox.hidden = true;
  }

  renderStats();
  renderLog();

  el.stageEmpty.hidden = true;
  el.stage.hidden = false;
  el.refire.disabled = false;
  // Loading this is what makes the armed beacons actually fire.
  el.stage.src = "/sandbox/" + session.id + "?t=" + Date.now();
}

/* ------------------------------------------------------------------- stats */

function renderStats() {
  const beacons = [...state.beacons.values()];
  const leaks = beacons.reduce((n, b) => n + b.verdict.leaks.length, 0);
  const critical = beacons.some((b) => b.verdict.severity === "critical");
  $("s-total").textContent = beacons.length;
  $("s-fired").textContent = beacons.filter((b) => b.state === "blocked").length;
  $("s-pixels").textContent = beacons.filter((b) => b.shape.isPixel).length;
  $("s-hosts").textContent = new Set(beacons.map((b) => b.host)).size;
  $("s-leaks").textContent = leaks;
  el.statLeaks.className = "stat" + (critical ? " hot" : leaks ? " warm" : "");
}

/* --------------------------------------------------------------------- log */

const STATE_CHIP = {
  blocked: ["blocked", "blocked"],
  armed: ["armed", "armed · not yet fetched"],
  "click-armed": ["click", "fires on click"],
};

function renderLog() {
  const onlyLeaks = el.onlyLeaks.checked;
  const beacons = [...state.beacons.values()]
    .filter((b) => !onlyLeaks || b.verdict.leaks.length > 0)
    .sort((a, b) => a.seq - b.seq);

  el.logEmpty.hidden = beacons.length > 0;
  if (!beacons.length) {
    el.log.innerHTML = "";
    if (state.session) {
      el.logEmpty.innerHTML = onlyLeaks
        ? "No beacon in this payload carries a recoverable identifier."
        : "This payload contained no remote URLs at all.";
    }
    return;
  }

  el.log.innerHTML = beacons
    .map((b) => {
      const [cls, label] = STATE_CHIP[b.state] ?? ["armed", b.state];
      const chips = [
        `<span class="chip ${cls}">${esc(label)}</span>`,
        b.shape.isPixel ? '<span class="chip pixel">pixel</span>' : "",
        b.verdict.vendor ? `<span class="chip vendor">${esc(b.verdict.vendor.name)}</span>` : "",
        b.hits > 1 ? `<span class="chip hits">&times;${b.hits}</span>` : "",
        `<span class="chip">${esc(b.origin)}</span>`,
      ].join("");
      return `<li data-id="${b.id}" aria-selected="${b.id === state.selected}">
        <span class="dot ${b.verdict.severity}" title="${b.verdict.severity}"></span>
        <span>
          <span class="row-top"><span class="row-host">${esc(b.host)}</span>${chips}</span>
          <span class="row-head">${esc(b.verdict.headline)}</span>
        </span>
      </li>`;
    })
    .join("");
}

el.log.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) select(li.dataset.id);
});
el.onlyLeaks.addEventListener("change", renderLog);
$("detail-close").addEventListener("click", () => {
  state.selected = null;
  el.detail.hidden = true;
  renderLog();
});

/* ------------------------------------------------------------------ detail */

const SOFT_LEAKS = new Set(["timestamp", "campaign-id"]);

function select(id) {
  const b = state.beacons.get(id);
  if (!b) return;
  state.selected = id;
  renderLog();
  renderDetail(b);
}

function renderDetail(b) {
  el.detail.hidden = false;
  el.detailTitle.textContent = "#" + b.seq + " · " + b.host;

  const parts = [];

  // Show the real URL alongside where it was actually sent instead.
  parts.push(`<div class="urlbox">${esc(b.url)}<br><span class="reroute">→ rerouted to /trap/${esc(b.id)} · answered locally with a 1×1 GIF</span></div>`);

  parts.push(`<dl class="kv">
    <dt>Severity</dt><dd style="color:var(--${b.verdict.severity})">${esc(b.verdict.severity)}</dd>
    <dt>Verdict</dt><dd style="font-family:inherit;font-size:12px">${esc(b.verdict.headline)}</dd>
    <dt>Vendor</dt><dd>${b.verdict.vendor ? esc(b.verdict.vendor.name) + " · " + esc(b.verdict.vendor.category) + " (" + esc(b.verdict.vendor.confidence) + ")" : "—"}</dd>
    <dt>Loaded by</dt><dd>${esc(b.origin)} · ${esc(b.attr)}</dd>
    <dt>Status</dt><dd>${b.state === "blocked" ? "requested by the sealed render, blocked here" : b.state === "click-armed" ? "would fire if the reader clicked" : "found in payload, not fetched"}${b.hits > 1 ? " · " + b.hits + " requests" : ""}</dd>
  </dl>`);

  if (b.shape.reasons.length) {
    parts.push("<h4>Why this is a pixel</h4>");
    parts.push(`<ul class="reasons">${b.shape.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`);
  }

  if (b.verdict.leaks.length) {
    parts.push("<h4>What it would have told the vendor</h4>");
    for (const l of b.verdict.leaks) {
      const soft = SOFT_LEAKS.has(l.kind) ? " soft" : "";
      parts.push(`<div class="leak${soft}">
        <div class="lk-top">
          <span class="lk-kind">${esc(l.kind)}</span>
          <span class="lk-val">${esc(l.value)}</span>
        </div>
        <div class="lk-meta">${esc(l.where)} · ${esc(l.via)}</div>
        <div class="lk-note">${esc(l.note)}</div>
      </div>`);
    }
  }

  if (b.verdict.params.length) {
    parts.push("<h4>Query parameters</h4><table class='params'><tr><th>Key</th><th>Value</th><th>Decoded</th></tr>");
    for (const p of b.verdict.params) {
      parts.push(`<tr>
        <td class="k">${esc(p.key)}${p.note ? `<br><span style="color:var(--faint);font-size:9.5px">${esc(p.note)}</span>` : ""}</td>
        <td>${esc(p.value)}</td>
        <td class="d">${p.decoded ? esc(p.decoded) : "—"}</td>
      </tr>`);
    }
    parts.push("</table>");
  }

  const headers = b.requestHeaders && Object.keys(b.requestHeaders);
  if (headers?.length) {
    parts.push("<h4>Headers the blocked request carried</h4>");
    parts.push("<table class='hdrs'>");
    for (const k of headers) {
      parts.push(`<tr><td class="k">${esc(k)}</td><td>${esc(b.requestHeaders[k])}</td></tr>`);
    }
    parts.push("</table>");
    parts.push(`<p class="hint">The identifier says who opened the message; these say what they opened it on. A real tracker logs both, plus the source IP it arrived from.</p>`);
  }

  el.detailBody.innerHTML = parts.join("");
}

/* --------------------------------------------------------------------- SSE */

function connect() {
  const es = new EventSource("/api/events");
  es.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "beacon-update") {
      if (!state.session || msg.beacon.sessionId !== state.session.id) return;
      state.beacons.set(msg.beacon.id, msg.beacon);
      renderStats();
      renderLog();
      if (state.selected === msg.beacon.id) renderDetail(msg.beacon);
    }
  };
  // EventSource reconnects on its own, but a dev-server restart closes hard.
  es.onerror = () => {};
}
connect();
