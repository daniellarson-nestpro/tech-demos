/* LiveAvatar GPT-Live — frontend: chat state, SSE streaming, avatar animation. */

const els = {
  frame: document.getElementById("avatar-frame"),
  veil: document.getElementById("connect-veil"),
  btnConnect: document.getElementById("btn-connect"),
  mouth: document.getElementById("mouth"),
  tongue: document.getElementById("tongue"),
  lidL: document.getElementById("lid-l"),
  lidR: document.getElementById("lid-r"),
  browL: document.getElementById("brow-l"),
  browR: document.getElementById("brow-r"),
  viz: document.getElementById("viz"),
  vizBars: document.querySelectorAll("#viz span"),
  caption: document.getElementById("caption"),
  pillState: document.getElementById("pill-state"),
  stageNote: document.getElementById("stage-note"),
  hudMode: document.getElementById("hud-mode"),
  hudLatency: document.getElementById("hud-latency"),
  hudFps: document.getElementById("hud-fps"),
  hudLive: document.getElementById("hud-live"),
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  input: document.getElementById("input"),
  btnSend: document.getElementById("btn-send"),
  chatSub: document.getElementById("chat-sub"),
};

const state = {
  connected: false,
  busy: false,
  history: [], // {role, content}
  speaking: false,
};

/* ------------------------------ avatar anim ------------------------------ */

// Blink loop — random interval, quick lid close/open.
(function blinkLoop() {
  const blink = () => {
    els.lidL.setAttribute("height", "20");
    els.lidR.setAttribute("height", "20");
    setTimeout(() => {
      els.lidL.setAttribute("height", "0");
      els.lidR.setAttribute("height", "0");
    }, 130);
    setTimeout(blink, 2200 + Math.random() * 3200);
  };
  setTimeout(blink, 1500);
})();

// Mouth + audio-viz loop, driven by state.speaking.
(function mouthLoop() {
  let t = 0;
  setInterval(() => {
    t += 1;
    if (state.speaking) {
      // Pseudo-viseme: layered sines + jitter for natural mouth motion.
      const amp =
        4 + 5.5 * Math.abs(Math.sin(t * 0.9)) + Math.random() * 3.5;
      els.mouth.setAttribute("ry", amp.toFixed(1));
      els.mouth.setAttribute("rx", (14 - amp * 0.35).toFixed(1));
      els.tongue.setAttribute("ry", Math.max(0, amp * 0.35).toFixed(1));
      els.vizBars.forEach((bar, i) => {
        const h = 3 + Math.abs(Math.sin(t * 0.7 + i * 1.1)) * 16 + Math.random() * 4;
        bar.style.height = `${h}px`;
      });
    } else {
      els.mouth.setAttribute("ry", "2.5");
      els.mouth.setAttribute("rx", "14");
      els.tongue.setAttribute("ry", "0");
      els.vizBars.forEach((bar) => (bar.style.height = "4px"));
    }
  }, 70);
})();

function setStageState(name) {
  els.frame.classList.toggle("speaking", name === "speaking");
  els.frame.classList.toggle("thinking", name === "thinking");
  els.pillState.textContent = name;
  els.pillState.className = `pill ${name}`;
  state.speaking = name === "speaking";
  els.viz.classList.toggle("on", name === "speaking");
  // Raise brows a touch while thinking.
  const up = name === "thinking";
  els.browL.setAttribute("d", up ? "M84 80 Q96 73 106 80" : "M84 84 Q96 78 106 84");
  els.browR.setAttribute("d", up ? "M134 80 Q144 73 156 80" : "M134 84 Q144 78 156 84");
}

/* ------------------------------ HUD ------------------------------ */

async function loadConfig() {
  const cfg = await fetch("/api/config").then((r) => r.json());
  els.hudMode.textContent = cfg.mode === "live" ? `live · ${cfg.model}` : "demo mode";
  els.stageNote.textContent =
    cfg.avatarProvider === "heygen-liveavatar"
      ? "HyperFrames pipeline: HeyGen LiveAvatar"
      : "HyperFrames pipeline: simulated";
  els.chatSub.textContent = `single-user session · ${cfg.mode} mode · persona: ${cfg.persona}`;
}

// Fake-but-alive fps counter for the session HUD.
setInterval(() => {
  if (!state.connected) return;
  els.hudFps.textContent = `${58 + Math.floor(Math.random() * 4)} fps`;
}, 1200);

/* ------------------------------ chat ------------------------------ */

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return div;
}

async function send(text, { hidden = false } = {}) {
  state.busy = true;
  els.input.disabled = true;
  els.btnSend.disabled = true;

  state.history.push({ role: "user", content: text });
  if (!hidden) addMessage("user", text);

  const bubble = addMessage("assistant", "");
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  bubble.appendChild(cursor);

  setStageState("thinking");
  els.caption.textContent = "";

  const t0 = performance.now();
  let firstToken = true;
  let full = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: state.history }),
    });
    if (!res.ok || !res.body) throw new Error(`server ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // Parse SSE frames: "event: X\ndata: Y\n\n"
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const evMatch = frame.match(/^event: (.+)$/m);
        const dataMatch = frame.match(/^data: (.+)$/m);
        if (!evMatch || !dataMatch) continue;
        const ev = evMatch[1];
        const data = JSON.parse(dataMatch[1]);

        if (ev === "token") {
          if (firstToken) {
            firstToken = false;
            els.hudLatency.textContent = `${Math.round(performance.now() - t0)} ms`;
            setStageState("speaking");
          }
          full += data.t;
          bubble.textContent = full;
          bubble.appendChild(cursor);
          els.caption.textContent = full.split(/\s+/).slice(-14).join(" ");
          els.messages.scrollTop = els.messages.scrollHeight;
        } else if (ev === "done") {
          full = data.full || full;
        }
      }
    }

    bubble.textContent = full;
    state.history.push({ role: "assistant", content: full });
  } catch (err) {
    bubble.textContent = `⚠ stream error: ${err.message}`;
  } finally {
    setStageState("idle");
    setTimeout(() => (els.caption.textContent = ""), 4000);
    state.busy = false;
    els.input.disabled = false;
    els.btnSend.disabled = false;
    els.input.focus();
  }
}

/* ------------------------------ wiring ------------------------------ */

els.btnConnect.addEventListener("click", async () => {
  els.veil.classList.add("hidden");
  state.connected = true;
  els.hudLive.classList.add("on");
  els.hudLive.innerHTML = "<i></i> LIVE";
  els.input.disabled = false;
  els.btnSend.disabled = false;
  els.input.focus();
  setStageState("idle");

  // Kick off a greeting so the session feels alive immediately;
  // the priming "hi" turn stays out of the visible transcript.
  await new Promise((r) => setTimeout(r, 600));
  await send("hi", { hidden: true });
});

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text || state.busy || !state.connected) return;
  els.input.value = "";
  send(text);
});

loadConfig();
setStageState("idle");
