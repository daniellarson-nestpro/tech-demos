/* Demo triggers + copy-CSS. Snippets are sliced out of transitions.css by marker. */

// ---- copy CSS -------------------------------------------------------------

const snippets = {};

fetch("/transitions.css")
  .then((r) => r.text())
  .then((css) => {
    const re = /\/\* === (\S+) === \*\/\n([\s\S]*?)\/\* === end === \*\//g;
    let m;
    while ((m = re.exec(css))) snippets[m[1]] = m[2].trim();
  });

for (const btn of document.querySelectorAll(".copy-btn")) {
  btn.addEventListener("click", async () => {
    const css = snippets[btn.dataset.copy];
    if (!css) return;
    try {
      await navigator.clipboard.writeText(css);
    } catch {
      // clipboard API unavailable (non-secure context) — fall back
      const ta = document.createElement("textarea");
      ta.value = css;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    btn.textContent = "Copied ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy CSS";
      btn.classList.remove("copied");
    }, 1400);
  });
}

// ---- 1. toast -------------------------------------------------------------

const toast = document.getElementById("toast");
let toastTimer;

document.querySelector('[data-action="toast"]').addEventListener("click", () => {
  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.classList.remove("closing");
  toast.classList.remove("open");
  void toast.offsetWidth; // restart animation
  toast.classList.add("open");
  toastTimer = setTimeout(() => {
    toast.classList.remove("open");
    toast.classList.add("closing");
    toast.addEventListener(
      "animationend",
      () => {
        toast.hidden = true;
        toast.classList.remove("closing");
      },
      { once: true },
    );
  }, 2200);
});

// ---- 2. tabs --------------------------------------------------------------

const tabs = document.getElementById("tabs");
tabs.querySelectorAll(".tab").forEach((tab, i) => {
  tab.addEventListener("click", () => {
    tabs.dataset.active = i;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
  });
});

// ---- 3. skeleton ----------------------------------------------------------

const profile = document.getElementById("skeleton");
const skBtn = document.querySelector('[data-action="skeleton"]');

skBtn.addEventListener("click", () => {
  if (profile.classList.contains("loaded")) {
    profile.classList.remove("loaded");
    skBtn.textContent = "Load";
  } else {
    skBtn.textContent = "Loading…";
    setTimeout(() => {
      profile.classList.add("loaded");
      skBtn.textContent = "Reset";
    }, 900);
  }
});

// ---- 4. number flip -------------------------------------------------------

const numflip = document.getElementById("numflip");

function setNumber(value) {
  numflip.innerHTML = "";
  [...value].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "digit";
    span.style.setProperty("--d", i);
    span.textContent = ch;
    numflip.appendChild(span);
  });
}

setNumber("$1,284.09");

document.querySelector('[data-action="number-flip"]').addEventListener("click", () => {
  const n = Math.random() * 9000 + 100;
  setNumber(
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
});

// ---- 5. error shake -------------------------------------------------------

const emailForm = document.getElementById("email-form");
const emailInput = emailForm.querySelector(".email-input");
const errorMsg = document.querySelector(".error-msg");

emailForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value);
  if (valid) {
    errorMsg.hidden = true;
    emailInput.classList.remove("invalid");
    emailInput.value = "";
    emailInput.placeholder = "Thanks! ✓";
  } else {
    errorMsg.hidden = false;
    emailInput.classList.remove("invalid");
    void emailInput.offsetWidth;
    emailInput.classList.add("invalid");
  }
});

// ---- 6. success check -----------------------------------------------------

const checkBadge = document.getElementById("check-badge");

function playCheck() {
  checkBadge.classList.remove("play");
  void checkBadge.offsetWidth;
  checkBadge.classList.add("play");
}

playCheck();
document.querySelector('[data-action="success-check"]').addEventListener("click", playCheck);

// ---- 7. spinner to check morph --------------------------------------------

const morphBtn = document.getElementById("morph-btn");
let morphBusy = false;

morphBtn.addEventListener("click", () => {
  if (morphBusy) return;
  morphBusy = true;
  morphBtn.classList.add("loading");
  setTimeout(() => {
    morphBtn.classList.remove("loading");
    morphBtn.classList.add("done");
    setTimeout(() => {
      morphBtn.classList.remove("done");
      morphBusy = false;
    }, 1600);
  }, 1200);
});

// ---- 8. like button -------------------------------------------------------

const likeBtn = document.getElementById("like-btn");

likeBtn.addEventListener("click", () => {
  if (likeBtn.classList.contains("liked")) {
    likeBtn.classList.remove("liked");
  } else {
    void likeBtn.offsetWidth;
    likeBtn.classList.add("liked");
  }
});

// ---- 9. notification badge ------------------------------------------------

const badge = document.getElementById("badge");
let badgeCount = 0;

document.querySelector('[data-action="badge"]').addEventListener("click", () => {
  badgeCount += 1;
  badge.textContent = badgeCount > 9 ? "9+" : badgeCount;
  badge.hidden = false;
  badge.classList.remove("pop");
  void badge.offsetWidth;
  badge.classList.add("pop");
});

// ---- 10. shimmer: runs on its own, no trigger needed ------------------------
