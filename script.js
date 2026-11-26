/* RETRA — interactions */
(() => {
  "use strict";
  document.documentElement.classList.add("js");

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const css = getComputedStyle(document.documentElement);
  const C = {
    text: css.getPropertyValue("--text").trim() || "#f1eee8",
    markets: css.getPropertyValue("--markets").trim() || "#ff6b57",
    callouts: css.getPropertyValue("--callouts").trim() || "#a594ff",
    proof: css.getPropertyValue("--proof").trim() || "#44e0a0",
    line: css.getPropertyValue("--line-2").trim() || "#33333c",
    dim: css.getPropertyValue("--dim").trim() || "#6b6a72",
  };

  /* ---------- toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }

  /* ---------- nav ---------- */
  const navToggle = $("#navToggle");
  const navLinks = $("#navLinks");
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  $$("a", navLinks).forEach((a) =>
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    })
  );

  /* ---------- contract address chip ---------- */
  $("#copyCa").addEventListener("click", async (e) => {
    const ca = e.currentTarget.dataset.ca || "";
    if (/^0x0+$/.test(ca)) return toast("Contract address not announced yet");
    try {
      await navigator.clipboard.writeText(ca);
      toast("Contract address copied");
    } catch {
      toast(ca);
    }
  });

  $("#year").textContent = new Date().getFullYear();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in-view");
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  // Runs fn once when el scrolls into view. If el is already on screen at load,
  // it keeps its finished resting state and nothing replays.
  function whenEntering(el, fn) {
    if (reduceMotion || !el) return;
    let first = true;
    const obs = new IntersectionObserver((entries) => {
      const en = entries[entries.length - 1];
      if (first) {
        first = false;
        if (en.isIntersecting) obs.disconnect();
        return;
      }
      if (en.isIntersecting) {
        obs.disconnect();
        fn();
      }
    });
    obs.observe(el);
  }

  /* =========================================================
     Market sessions (New York time)
     ========================================================= */
  const SESSIONS = {
    pre: {
      name: "Pre-market", fee: 0.3, flow: "Tighter", price: "Live external check",
      data: "Supported PRE feed · < 120 s", note: "Thinner books pay more. Per-swap and rolling caps tighten to protect LPs.",
    },
    regular: {
      name: "Regular", fee: 0.05, flow: "Standard", price: "Live external check",
      data: "Verified regular feed · < 60 s", note: "Deepest liquidity, cheapest fee, standard limits.",
    },
    post: {
      name: "After-hours", fee: 0.3, flow: "Tighter", price: "Live external check",
      data: "Supported POST feed · < 120 s", note: "Same rules as pre-market: higher fee, tighter caps.",
    },
    overnight: {
      name: "Overnight", fee: 0.5, flow: "Tight", price: "Own market or checked",
      data: "Overnight feed · < 120 s", note: "Market-price pools keep trading. Checked pools step aside if the feed goes stale.",
    },
    closed: {
      name: "Scheduled close", fee: 1.0, flow: "Finite budget", price: "Historical anchor",
      data: "Calendar-proven close", note: "One fixed budget per closure. It does not refill until a verified reopen.",
    },
  };

  // NYSE full-day holidays (simplified calendar for this preview)
  const HOLIDAYS = new Set([
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
    "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
    "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
  ]);

  function nyNow() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const hh = Number(get("hour")) % 24;
    const mm = Number(get("minute"));
    return { date: `${get("year")}-${get("month")}-${get("day")}`, wd: get("weekday"), hh, mm, t: hh + mm / 60 };
  }

  function sessionAt(n) {
    if (HOLIDAYS.has(n.date)) return "closed";
    if (n.wd === "Sat") return "closed";
    if (n.wd === "Sun" && n.t < 20) return "closed";
    if (n.wd === "Fri" && n.t >= 20) return "closed";
    if (n.t < 4) return "overnight";
    if (n.t < 9.5) return "pre";
    if (n.t < 16) return "regular";
    if (n.t < 20) return "post";
    return "overnight";
  }

  const fmtFee = (f) => f.toFixed(2) + "%";
  const sessionBtns = $$(".session");
  let liveSession = null;

  function showSession(key) {
    const s = SESSIONS[key];
    sessionBtns.forEach((b) => {
      const on = b.dataset.session === key;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $("#sdFee").textContent = fmtFee(s.fee);
    $("#sdFeeBar").style.width = Math.max(5, s.fee * 100) + "%";
    $("#sdFlow").textContent = s.flow;
    $("#sdPrice").textContent = s.price;
    $("#sdData").textContent = s.data;
    $("#sdNote").textContent = s.note;
  }
  sessionBtns.forEach((b) => b.addEventListener("click", () => showSession(b.dataset.session)));

  function tickClock() {
    const n = nyNow();
    const key = sessionAt(n);
    const s = SESSIONS[key];
    $("#nyClock").textContent = `${String(n.hh).padStart(2, "0")}:${String(n.mm).padStart(2, "0")} ET`;
    $("#heroSession").textContent = s.name;
    $("#heroFee").textContent = "base fee " + fmtFee(s.fee);
    $("#timelineNow").style.left = (n.t / 24) * 100 + "%";
    if (key !== liveSession) {
      sessionBtns.forEach((b) => b.classList.toggle("is-now", b.dataset.session === key));
      if (liveSession === null) showSession(key);
      liveSession = key;
    }
  }
  tickClock();
  setInterval(tickClock, 20000);

  /* =========================================================
     Canvas helpers
     ========================================================= */
  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }
  function alpha(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function roundBar(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- hero: live liquidity bins ---------- */
  (function heroBins() {
    const canvas = $("#binsCanvas");
    if (!canvas) return;
    let dims = fitCanvas(canvas);
    let visible = true;
    const N = 44;
    const seeds = Array.from({ length: N }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1);

    function frame(time) {
      const { ctx, w, h } = dims;
      const t = (time || 0) / 1000;
      ctx.clearRect(0, 0, w, h);

      const gap = 3;
      const bw = (w - gap * (N - 1)) / N;
      const active = Math.round(N / 2 + Math.sin(t * 0.35) * 5 + Math.sin(t * 0.13) * 3);
      const base = h - 18;

      // grid lines
      ctx.strokeStyle = alpha(C.line, 0.6);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (let g = 1; g <= 3; g++) {
        const y = (base / 4) * g;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.setLineDash([]);

      const tops = [];
      for (let i = 0; i < N; i++) {
        const d = (i - N / 2) / (N / 2);
        const shape = Math.exp(-d * d * 2.2) * 0.75 + 0.12 + Math.abs(seeds[i]) * 0.18;
        const wobble = Math.sin(t * 1.3 + i * 0.6) * 0.05 + Math.sin(t * 0.7 + i * 0.25) * 0.04;
        const v = Math.max(0.06, Math.min(1, shape + wobble));
        const bh = v * (base - 10);
        const x = i * (bw + gap);
        const y = base - bh;
        tops.push([x + bw / 2, y]);
        if (i === active) ctx.fillStyle = C.text;
        else if (i < active) ctx.fillStyle = alpha(C.callouts, 0.35 + 0.4 * (1 - (active - i) / N));
        else ctx.fillStyle = alpha(C.markets, 0.35 + 0.4 * (1 - (i - active) / N));
        roundBar(ctx, x, y, bw, bh, 2);
      }

      // price line through tops
      ctx.strokeStyle = alpha(C.text, 0.35);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      tops.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 6) : ctx.moveTo(x, y - 6)));
      ctx.stroke();

      // active marker
      const ax = active * (bw + gap) + bw / 2;
      ctx.strokeStyle = alpha(C.text, 0.7);
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, base); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text;
      ctx.font = "500 10px 'Geist Mono', monospace";
      ctx.textAlign = ax > w - 40 ? "right" : "left";
      ctx.fillText("SPOT", ax + (ax > w - 40 ? -6 : 6), 10);

      // baseline
      ctx.fillStyle = alpha(C.line, 1);
      ctx.fillRect(0, base, w, 1);
      ctx.fillStyle = C.dim;
      ctx.textAlign = "left";
      ctx.fillText("BINS", 0, h - 3);
      ctx.textAlign = "right";
      ctx.fillText("LIQUIDITY BY PRICE", w, h - 3);

      if (visible && !reduceMotion) requestAnimationFrame(frame);
    }

    new IntersectionObserver(([en]) => {
      const was = visible;
      visible = en.isIntersecting;
      if (visible && !was) requestAnimationFrame(frame);
    }).observe(canvas);

    window.addEventListener("resize", () => { dims = fitCanvas(canvas); if (reduceMotion) frame(0); });
    requestAnimationFrame(frame);
  })();

  /* ---------- hero: rotating feed ---------- */
  (function heroFeed() {
    const el = $("#heroFeed");
    const items = [
      "@caller · CURVE · 14 bins · IN RANGE",
      "@lpwhale · SPOT · 32 bins · TAILED ×18",
      "@nvda_bins · BID-ASK · 20 bins · IN RANGE 91%",
      "@freshwallet · SPOT · 8 bins · NEW WALLET",
    ];
    let i = 0;
    if (reduceMotion) return;
    setInterval(() => {
      el.style.opacity = "0";
      setTimeout(() => {
        i = (i + 1) % items.length;
        el.textContent = items[i];
        el.style.opacity = "1";
      }, 300);
    }, 3600);
  })();

  /* ---------- markets: opening auction book ---------- */
  (function book() {
    const wrap = $("#bookBars");
    if (!wrap) return;
    const N = 30, lo = 340, hi = 355, clear = 349;
    for (let i = 0; i < N; i++) {
      const p = lo + (i / (N - 1)) * (hi - lo);
      const isBuy = i % 2 === 0;
      const matched = isBuy ? p >= clear - 0.25 : p <= clear + 0.25;
      const dist = Math.abs(p - clear) / (hi - lo);
      const hgt = 28 + (1 - dist) * 60 + ((i * 37) % 11) * 1.4;
      const b = document.createElement("span");
      b.className = `b ${isBuy ? "b--buy" : "b--sell"}${matched ? "" : " b--dim"}`;
      b.style.height = Math.min(100, hgt) + "%";
      b.style.setProperty("--d", i * 18 + "ms");
      wrap.appendChild(b);
    }
    const line = document.createElement("span");
    line.className = "clear";
    line.style.left = ((clear - lo) / (hi - lo)) * 100 + "%";
    wrap.appendChild(line);
    const bookEl = wrap.closest(".book");
    whenEntering(bookEl, () => bookEl.classList.add("animate"));
  })();

  /* ---------- callouts: range card ---------- */
  (function calloutCard() {
    const canvas = $("#calloutCanvas");
    if (!canvas) return;
    let dims = fitCanvas(canvas);
    const N = 32;
    const ACTIVE = 22; // price moved up since the call
    const RANGE = 14;
    const exactStart = 6; // caller's original bins
    const shapeStart = ACTIVE - RANGE; // same shape re-anchored under spot
    let offset = exactStart;
    let target = exactStart;
    const pool = Array.from({ length: N }, (_, i) => {
      const d = (i - ACTIVE) / 12;
      return 0.18 + Math.exp(-d * d) * 0.32 + ((i * 53) % 7) * 0.012;
    });

    function draw() {
      const { ctx, w, h } = dims;
      ctx.clearRect(0, 0, w, h);
      const gap = 3;
      const bw = (w - gap * (N - 1)) / N;
      const base = h - 16;

      for (let i = 0; i < N; i++) {
        const x = i * (bw + gap);
        const bh = pool[i] * (base - 8);
        ctx.fillStyle = alpha(C.line, 0.9);
        roundBar(ctx, x, base - bh, bw, bh, 2);
      }

      // caller curve range
      for (let k = 0; k < RANGE; k++) {
        const pos = offset + k;
        const x = pos * (bw + gap);
        const d = (k - (RANGE - 1) / 2) / (RANGE / 2);
        const v = 0.25 + Math.exp(-d * d * 1.6) * 0.65;
        const bh = v * (base - 8);
        ctx.fillStyle = alpha(C.callouts, 0.85);
        roundBar(ctx, x, base - bh, bw, bh, 2);
      }

      const ax = ACTIVE * (bw + gap);
      ctx.fillStyle = C.text;
      roundBar(ctx, ax, 6, bw, base - 6, 2);

      ctx.fillStyle = alpha(C.line, 1);
      ctx.fillRect(0, base, w, 1);
      ctx.font = "500 10px 'Geist Mono', monospace";
      ctx.fillStyle = C.dim;
      ctx.textAlign = "left";
      ctx.fillText("RANGE · 14 BINS", 0, h - 2);
      ctx.textAlign = "right";
      ctx.fillStyle = C.text;
      ctx.fillText("ACTIVE", ax - 4, 14);

      if (Math.abs(offset - target) > 0.01) {
        offset += (target - offset) * (reduceMotion ? 1 : 0.14);
        requestAnimationFrame(draw);
      } else {
        offset = target;
      }
    }

    const notes = {
      exact: "Prefills the caller's 14 bins. You choose the size and sign.",
      shape: "Same 14-bin curve, re-anchored just under the active bin. You choose the size and sign.",
    };
    $$(".seg-toggle button").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$(".seg-toggle button").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", String(on));
        });
        const mode = btn.dataset.tail;
        target = mode === "shape" ? shapeStart : exactStart;
        $("#tailNote").textContent = notes[mode];
        requestAnimationFrame(draw);
      })
    );

    const tailBtn = $("#tailBtn");
    tailBtn.addEventListener("click", () => {
      tailBtn.textContent = "Prefilled ✓";
      toast("Demo: range prefilled — review the size and sign in the app");
      setTimeout(() => (tailBtn.textContent = "Tail"), 2200);
    });

    window.addEventListener("resize", () => { dims = fitCanvas(canvas); draw(); });
    draw();
  })();

  /* ---------- proof: terminal ---------- */
  (function terminal() {
    const el = $("#terminal");
    if (!el) return;
    const cmd = "retra-proof intake arXiv:2601.01234";
    const lines = [
      ["t-hi", "Example: sparse attention for protein–ligand docking"],
      ["t-dim", "4 authors · preprint · open access (CC-BY-4.0)"],
      ["", ""],
      ["", "readiness   <span class='t-ok'>READY</span>   5 of 5 core checks pass"],
      ["", "  <span class='t-ok'>pass</span>  code_found       github.com/example/sparse-dock"],
      ["", "  <span class='t-ok'>pass</span>  code_license     Apache-2.0"],
      ["", "  <span class='t-ok'>pass</span>  data_found       4 dataset links"],
      ["", "  <span class='t-ok'>pass</span>  open_access      free to read"],
      ["", "  <span class='t-ok'>pass</span>  env_resolves     container builds"],
      ["", "  <span class='t-warn'>warn</span>  code_snapshot    pin a commit before the run"],
      ["", ""],
      ["", "claims      table_2 · figure_3b"],
      ["", "bounty      250 USDG → escrow"],
      ["t-ok", "manifest.yaml ready for review"],
    ];

    const render = (typed, shown, caret) =>
      `<span class="t-dim">$</span> <span class="t-cmd">${typed}</span>` +
      (shown.length ? "\n" + shown.map(([c, s]) => (c ? `<span class="${c}">${s}</span>` : s)).join("\n") : "") +
      (caret ? ' <span class="caret"></span>' : "");

    function run() {
      let i = 0;
      const typeTimer = setInterval(() => {
        i++;
        el.innerHTML = render(cmd.slice(0, i), [], true);
        if (i >= cmd.length) {
          clearInterval(typeTimer);
          let j = 0;
          const lineTimer = setInterval(() => {
            j++;
            el.innerHTML = render(cmd, lines.slice(0, j), j >= lines.length);
            if (j >= lines.length) clearInterval(lineTimer);
          }, 140);
        }
      }, 38);
    }

    // Full output at rest; the typing replays when the terminal scrolls into view.
    el.innerHTML = render(cmd, lines, true);
    whenEntering(el, run);
  })();

  /* ---------- proof: verdicts ---------- */
  (function verdicts() {
    const data = {
      replicated: { claim: "table_2.auroc", paper: "0.912", rerun: "0.909", tol: "± 0.005", nodes: "2 of 2 agree", note: "Inside the tolerance written in the manifest.", color: C.proof },
      partial: { claim: "figure_3b.slope", paper: "0.84", rerun: "0.79", tol: "± 0.03", nodes: "2 of 2 agree", note: "Same direction, outside tolerance. Both values are shown.", color: "#ffb547" },
      failed: { claim: "table_4.rmsd", paper: "1.21 Å", rerun: "2.87 Å", tol: "± 0.15 Å", nodes: "2 of 2 agree", note: "Not reproduced with the published code and data.", color: "#ff5d73" },
      norun: { claim: "supp_s2.heldout", paper: "0.88", rerun: "—", tol: "± 0.01", nodes: "n/a", note: "Held-out set is not public. The bounty still pays, and authors can reply.", color: C.dim },
    };
    const btns = $$(".verdict");
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        btns.forEach((x) => {
          const on = x === b;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-selected", String(on));
        });
        const d = data[b.dataset.v];
        $("#vClaim").textContent = d.claim;
        $("#vPaper").textContent = d.paper;
        $("#vRerun").textContent = d.rerun;
        $("#vTol").textContent = d.tol;
        $("#vNodes").textContent = d.nodes;
        const note = $("#vNote");
        note.textContent = d.note;
        note.style.color = d.color;
      })
    );
  })();
})();
