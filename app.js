
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  if (!window.AtlasCore) return; // the "could not start" banner in index.html stays visible
  $("loadError").hidden = true;
  const core = window.AtlasCore;

  const AUTO_CLEAR_SECONDS = 60;
  const CLIPBOARD_CLEAR_SECONDS = 30;
  const ARC_LENGTH = 276.46; // 2 * PI * 44, the circumference of the strength dial
  const PLACEHOLDER = "Click “Generate password” to begin";
  const TYPE_IDS = ["lower", "upper", "digits", "symbols"];

  const els = {
    password: $("password"), generate: $("generate"), copy: $("copy"), toggle: $("toggle"), clear: $("clear"),
    status: $("status"), timer: $("timer"), length: $("length"), lengthValue: $("lengthValue"),
    ambiguous: $("ambiguous"), arc: $("dialArc"), bits: $("bits"), label: $("strengthLabel"), note: $("strengthNote"),
  };

  let current = "";       // the password on screen (kept only in memory)
  let masked = false;
  let animationId = 0;
  let countdown = 0;
  let clipboardTimer = 0;

  const charClass = (ch) => (/[0-9]/.test(ch) ? "d" : /[A-Za-z]/.test(ch) ? "l" : "s");

  function setStatus(msg, warn) {
    els.status.textContent = msg;
    els.status.classList.toggle("warn", Boolean(warn));
  }

  function paint(text, revealed, pool) {
    els.password.textContent = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      if (masked) {
        span.className = "m"; span.textContent = "•";
      } else if (i < revealed) {
        span.className = charClass(ch); span.textContent = ch;
      } else {
        span.className = "scramble"; span.textContent = pool[core.randomInt(pool.length)];
      }
      els.password.appendChild(span);
    });
  }

  // Short "decoding" animation; the real password settles in left to right.
  function reveal(pw, pool) {
    const id = ++animationId;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || masked) return paint(pw, pw.length, pool);
    const start = performance.now();
    (function frame(now) {
      if (id !== animationId) return;
      const p = Math.min((now - start) / 450, 1);
      paint(pw, Math.floor(p * pw.length), pool);
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  // Resize the card (and password font) to suit the password length, so nothing overflows.
  function fitCard(length) {
    const root = document.documentElement.style;
    if (!length) {
      root.removeProperty("--card-w");
      root.removeProperty("--pw-size");
      return;
    }
    const span = core.MAX_LENGTH - core.MIN_LENGTH;
    const t = Math.min(Math.max((length - core.MIN_LENGTH) / span, 0), 1); // 0 (shortest) to 1 (longest)
    root.setProperty("--card-w", Math.round(580 + t * 320) + "px");
    root.setProperty("--pw-size", (1.55 - t * 0.45).toFixed(2) + "rem");
  }

  function showStrength(bits) {
    const r = core.rate(bits);
    els.arc.style.strokeDashoffset = ARC_LENGTH * (1 - Math.min(bits / 128, 1));
    els.arc.style.stroke = `var(--${r.key})`;
    els.bits.textContent = Math.round(bits);
    els.label.textContent = r.name;
    els.label.style.color = `var(--${r.key})`;
    els.note.textContent = r.note + " (Estimate)";
  }

  /* ---- Security: auto-clear, manual clear, clipboard clear ---- */

  function startCountdown() {
    clearInterval(countdown);
    let left = AUTO_CLEAR_SECONDS;
    els.timer.textContent = `Auto-clears in ${left}s`;
    countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) clearAll("Password cleared automatically.");
      else els.timer.textContent = `Auto-clears in ${left}s`;
    }, 1000);
  }

  function clearAll(message) {
    animationId++;
    clearInterval(countdown);
    current = "";
    fitCard(0);
    els.password.textContent = PLACEHOLDER;
    els.password.classList.add("placeholder");
    els.arc.style.strokeDashoffset = ARC_LENGTH;
    els.arc.style.stroke = "";
    els.bits.textContent = "–";
    els.label.textContent = "No password yet";
    els.label.style.color = "";
    els.note.textContent = "Generate a password to see how strong it is.";
    els.timer.textContent = "";
    els.copy.disabled = true;
    els.toggle.disabled = true;
    els.clear.disabled = true;
    setStatus(message || "");
  }

  /* ---- Events ---- */

  // The ONLY place a password is generated.
  function onGenerate() {
    let result;
    try {
      result = core.generate({
        length: Number(els.length.value),
        lower: $("lower").checked, upper: $("upper").checked,
        digits: $("digits").checked, symbols: $("symbols").checked,
        noLookalikes: els.ambiguous.checked,
      });
    } catch (err) {
      setStatus(err.message, true);
      return;
    }
    current = result.password;
    fitCard(current.length);
    els.password.classList.remove("placeholder");
    reveal(current, result.pool);
    showStrength(result.bits);
    els.copy.disabled = false; els.copy.textContent = "Copy";
    els.toggle.disabled = false; els.clear.disabled = false;
    setStatus("");
    startCountdown();
  }

  async function onCopy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      els.copy.textContent = "Copied";
      setStatus(`Copied. The clipboard is cleared in ${CLIPBOARD_CLEAR_SECONDS}s.`);
      setTimeout(() => { els.copy.textContent = "Copy"; }, 1800);
      clearTimeout(clipboardTimer);
      clipboardTimer = setTimeout(async () => {
        try { await navigator.clipboard.writeText(""); setStatus("Clipboard cleared."); } catch (e) { /* tab not focused: nothing to do */ }
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch (err) {
      setStatus("Copy failed. Select the password and copy it manually.", true);
    }
  }

  function onToggle() {
    masked = !masked;
    els.toggle.textContent = masked ? "Show" : "Hide";
    if (current) paint(current, current.length, "");
  }

  function onOptionChange() {
    els.lengthValue.textContent = els.length.value;
    if (current) setStatus("Options changed. Click “Generate password” to apply them.");
  }

  els.generate.addEventListener("click", onGenerate);
  els.copy.addEventListener("click", onCopy);
  els.toggle.addEventListener("click", onToggle);
  els.clear.addEventListener("click", () => clearAll("Password cleared."));
  els.length.addEventListener("input", onOptionChange);
  els.ambiguous.addEventListener("change", onOptionChange);
  TYPE_IDS.forEach((id) => $(id).addEventListener("change", onOptionChange));
})();
