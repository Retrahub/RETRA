/*
 * RETRA app — Week 1: wallet sign-in + Uniswap v4 positions on Robinhood Chain.
 * Read-only: this page never sends a transaction. Signing in is one EIP-191 message signature.
 */
import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  stringToHex,
  verifyMessage,
} from "https://cdn.jsdelivr.net/npm/viem@2.39.3/+esm";
import { BLOCKSCOUT_API, CHAIN, CONTRACTS, MAX_POSITIONS, SESSION_HOURS } from "./chain.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const ZERO = "0x0000000000000000000000000000000000000000";

/* =========================================================
   Text (EN / ID). The language choice is shared with the home page.
   ========================================================= */
const STR = {
  en: {
    eyebrow: "Week 1 preview · read only",
    title: "Your LP positions",
    lead: "Connect a wallet to sign in, or paste any address. RETRA reads Uniswap v4 positions straight from Robinhood Chain. Nothing on this page sends a transaction.",
    signinTitle: "Sign in with your wallet",
    signinBody: "One signature proves the wallet is yours. No gas, no approval.",
    connect: "Connect wallet",
    connecting: "Waiting for your wallet…",
    signIn: "Sign in",
    signing: "Check your wallet and sign the message…",
    signOut: "Sign out",
    signedIn: "Signed in",
    notSigned: "Connected · not signed in",
    signedInMsg: "Signed in. This wallet is proven to be yours.",
    signedOutMsg: "Signed out of RETRA. To fully disconnect, remove this site in your wallet's connected sites.",
    netOk: "Robinhood Chain",
    netWrong: "Other network",
    switchNet: "Switch to Robinhood Chain",
    noWallet: "No wallet found in this browser. Install MetaMask or Rabby, or paste an address below to look around.",
    rejected: "Request cancelled in your wallet.",
    pending: "Your wallet already has a request open. Open the wallet to finish or cancel it.",
    sigBad: "That signature doesn't match this wallet. Try signing in again.",
    lookupLabel: "Or view any address",
    lookupBtn: "View positions",
    badAddr: "That isn't a wallet address. It starts with 0x and has 42 characters.",
    posTitle: "Positions",
    ownerFor: (a) => `Owner ${a}`,
    emptyStart: "Connect a wallet or paste an address to see its Uniswap v4 positions on Robinhood Chain.",
    emptyNone: "No Uniswap v4 positions found for this address on Robinhood Chain.",
    emptyActive: "This address only has closed positions. Turn on “Show closed positions” to see them.",
    errLoad: "Couldn't read positions right now. The public RPC or the explorer may be busy. Try again in a minute.",
    retry: "Try again",
    showClosed: "Show closed positions",
    statTotal: "Positions",
    statActive: "Active",
    statInRange: "In range",
    in: "In range",
    below: "Out of range · below",
    above: "Out of range · above",
    closed: "Closed",
    unknown: "Status unknown",
    range: "Price range",
    current: "Current price",
    fee: "Fee",
    hook: "Hook",
    noHook: "None",
    dynamic: "Dynamic",
    unit: (quote, base) => `Prices in ${quote} per ${base}`,
    post: "Post callout",
    postSoon: "Posting arrives in week 2",
    soon: "soon",
    more: (n) => `Showing the first ${n} positions.`,
    explorer: "View on explorer ↗",
    copied: "Address copied",
    back: "← Back to the RETRA home page",
    footer: "Data is read live from Robinhood Chain (public RPC), Blockscout and Uniswap v4. LP positions can lose value. Nothing here is financial advice.",
  },
  id: {
    eyebrow: "Pratinjau minggu 1 · hanya baca",
    title: "Posisi LP kamu",
    lead: "Hubungkan wallet untuk masuk, atau tempel alamat apa pun. RETRA membaca posisi Uniswap v4 langsung dari Robinhood Chain. Halaman ini tidak pernah mengirim transaksi.",
    signinTitle: "Masuk dengan wallet",
    signinBody: "Satu tanda tangan membuktikan wallet ini milikmu. Tanpa gas, tanpa approval.",
    connect: "Hubungkan wallet",
    connecting: "Menunggu wallet kamu…",
    signIn: "Masuk",
    signing: "Buka wallet kamu dan tanda tangani pesannya…",
    signOut: "Keluar",
    signedIn: "Sudah masuk",
    notSigned: "Terhubung · belum masuk",
    signedInMsg: "Berhasil masuk. Wallet ini terbukti milikmu.",
    signedOutMsg: "Sudah keluar dari RETRA. Untuk memutus sepenuhnya, hapus situs ini dari daftar situs terhubung di wallet kamu.",
    netOk: "Robinhood Chain",
    netWrong: "Jaringan lain",
    switchNet: "Pindah ke Robinhood Chain",
    noWallet: "Tidak ada wallet di browser ini. Pasang MetaMask atau Rabby, atau tempel alamat di bawah untuk melihat-lihat.",
    rejected: "Permintaan dibatalkan di wallet.",
    pending: "Masih ada permintaan yang terbuka di wallet kamu. Buka wallet untuk menyelesaikan atau membatalkannya.",
    sigBad: "Tanda tangan tidak cocok dengan wallet ini. Coba masuk lagi.",
    lookupLabel: "Atau lihat alamat lain",
    lookupBtn: "Lihat posisi",
    badAddr: "Itu bukan alamat wallet. Alamat diawali 0x dan panjangnya 42 karakter.",
    posTitle: "Posisi",
    ownerFor: (a) => `Pemilik ${a}`,
    emptyStart: "Hubungkan wallet atau tempel alamat untuk melihat posisi Uniswap v4-nya di Robinhood Chain.",
    emptyNone: "Tidak ada posisi Uniswap v4 untuk alamat ini di Robinhood Chain.",
    emptyActive: "Alamat ini hanya punya posisi yang sudah ditutup. Nyalakan “Tampilkan posisi tertutup” untuk melihatnya.",
    errLoad: "Posisi belum bisa dibaca. RPC publik atau explorer mungkin sedang sibuk. Coba lagi sebentar lagi.",
    retry: "Coba lagi",
    showClosed: "Tampilkan posisi tertutup",
    statTotal: "Posisi",
    statActive: "Aktif",
    statInRange: "Dalam range",
    in: "Dalam range",
    below: "Di luar range · bawah",
    above: "Di luar range · atas",
    closed: "Tertutup",
    unknown: "Status tidak diketahui",
    range: "Range harga",
    current: "Harga sekarang",
    fee: "Fee",
    hook: "Hook",
    noHook: "Tidak ada",
    dynamic: "Dinamis",
    unit: (quote, base) => `Harga dalam ${quote} per ${base}`,
    post: "Posting callout",
    postSoon: "Fitur posting hadir di minggu 2",
    soon: "segera",
    more: (n) => `Menampilkan ${n} posisi pertama.`,
    explorer: "Lihat di explorer ↗",
    copied: "Alamat disalin",
    back: "← Kembali ke beranda RETRA",
    footer: "Data dibaca langsung dari Robinhood Chain (RPC publik), Blockscout, dan Uniswap v4. Posisi LP bisa rugi. Tidak ada isi halaman ini yang merupakan nasihat keuangan.",
  },
};
let lang = "en";
const t = (key, ...args) => {
  const v = STR[lang][key] ?? STR.en[key];
  return typeof v === "function" ? v(...args) : v;
};

/* =========================================================
   Helpers
   ========================================================= */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const int24 = (x) => {
  const n = Number(x & 0xffffffn);
  return n >= 0x800000 ? n - 0x1000000 : n;
};
const fmtFee = (pips) => `${+(pips / 10000).toFixed(4)}%`; // Uniswap fees are in hundredths of a basis point
function fmtPrice(x) {
  if (!Number.isFinite(x)) return "∞";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e9 || a < 1e-6) return x.toExponential(3);
  if (a >= 1000) return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (a >= 1) return x.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return x.toPrecision(4);
}
const cleanSymbol = (s, addr) => {
  const v = String(s || "").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 14);
  return v || short(addr);
};

const toastEl = $("#toast");
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

async function fetchJson(url, ms = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   Chain client + ABIs
   ========================================================= */
const chain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [CHAIN.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: CHAIN.explorer } },
  contracts: { multicall3: { address: CONTRACTS.multicall3 } },
});
const client = createPublicClient({ chain, transport: http(CHAIN.rpc, { timeout: 20000, retryCount: 2 }) });

const pmAbi = parseAbi([
  "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)",
]);
const svAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);
const MC = { allowFailure: true, batchSize: 32768 };

const poolIdOf = (k) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
      [k.currency0, k.currency1, k.fee, k.tickSpacing, k.hooks]
    )
  );

/* =========================================================
   State
   ========================================================= */
const state = {
  account: null, // checksummed address the wallet gave us
  chainOk: null, // true / false / null (unknown)
  session: null, // { address, message, signature, issuedAt }
  busy: false,
  owner: null, // address whose positions are on screen
  positions: null,
  more: false,
  loading: false,
  error: null,
};

/* ---------- session (remembered sign-in) ---------- */
const SESSION_KEY = "retra-session";
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (s && s.address && Date.now() - Date.parse(s.issuedAt) < SESSION_HOURS * 3600e3) return s;
  } catch (e) {
    /* storage unavailable or corrupt: start signed out */
  }
  return null;
}
function saveSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    /* storage unavailable: the sign-in just isn't remembered */
  }
}
const sessionFor = (addr) => (state.session && addr && state.session.address === addr ? state.session : null);

/* =========================================================
   Wallet: connect, sign in (EIP-191), network
   ========================================================= */
const wallet = () => window.ethereum;

// The account message remembers its string key so a language switch can redraw it.
let msgKey = "";
function setMsg(text, tone = "", key = "") {
  msgKey = key;
  const el = $("#accountMsg");
  el.textContent = text || "";
  el.dataset.tone = tone;
}
const say = (key, tone = "") => setMsg(t(key), tone, key);
function setBusy(on) {
  state.busy = on;
  ["#connectBtn", "#signBtn", "#switchBtn", "#signOutBtn", "#walletBtn"].forEach((s) => ($(s).disabled = on));
}
function walletError(e) {
  const code = e?.code ?? e?.cause?.code;
  if (code === 4001) return say("rejected", "warn");
  if (code === -32002) return say("pending", "warn");
  setMsg(e?.shortMessage || e?.message || String(e), "error");
}

async function refreshChain() {
  if (!wallet() || !state.account) {
    state.chainOk = null;
    return;
  }
  try {
    state.chainOk = parseInt(await wallet().request({ method: "eth_chainId" }), 16) === CHAIN.id;
  } catch (e) {
    state.chainOk = null;
  }
}

async function setAccount(addr) {
  state.account = addr ? getAddress(addr) : null;
  if (state.session && state.session.address !== state.account) {
    state.session = null;
    saveSession(null);
  }
  await refreshChain();
  renderAccount();
  if (state.account) loadPositions(state.account, { updateUrl: false });
}

async function connect() {
  if (!wallet()) return say("noWallet", "warn");
  setBusy(true);
  say("connecting");
  try {
    const [acct] = await wallet().request({ method: "eth_requestAccounts" });
    await setAccount(acct);
    setMsg("");
    if (!sessionFor(state.account)) await signIn();
  } catch (e) {
    walletError(e);
  } finally {
    setBusy(false);
  }
}

function buildMessage(address) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  const issuedAt = new Date().toISOString();
  const message = [
    `${location.host} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to RETRA. This only proves you own this wallet. It sends no transaction and costs no gas.",
    "",
    `URI: ${location.origin}${location.pathname}`,
    "Version: 1",
    `Chain ID: ${CHAIN.id}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
  return { message, issuedAt };
}

async function signIn() {
  if (!state.account || !wallet()) return;
  setBusy(true);
  say("signing");
  try {
    const address = state.account;
    const { message, issuedAt } = buildMessage(address);
    const signature = await wallet().request({ method: "personal_sign", params: [stringToHex(message), address] });
    // Plain wallets verify locally; smart-contract wallets (ERC-1271) are checked on-chain.
    const ok =
      (await verifyMessage({ address, message, signature }).catch(() => false)) ||
      (await client.verifyMessage({ address, message, signature }).catch(() => false));
    if (!ok) return say("sigBad", "error");
    state.session = { address, message, signature, issuedAt };
    saveSession(state.session);
    say("signedInMsg", "ok");
  } catch (e) {
    walletError(e);
  } finally {
    setBusy(false);
    renderAccount();
  }
}

function signOut() {
  state.session = null;
  saveSession(null);
  state.account = null;
  state.chainOk = null;
  renderAccount();
  say("signedOutMsg");
}

async function switchNetwork() {
  setBusy(true);
  try {
    try {
      await wallet().request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] });
    } catch (e) {
      const code = e?.code ?? e?.data?.originalError?.code;
      if (code !== 4902) throw e;
      await wallet().request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN.hex,
            chainName: CHAIN.name,
            nativeCurrency: CHAIN.nativeCurrency,
            rpcUrls: [CHAIN.rpc],
            blockExplorerUrls: [CHAIN.explorer],
          },
        ],
      });
    }
    await refreshChain();
    setMsg("");
  } catch (e) {
    walletError(e);
  } finally {
    setBusy(false);
    renderAccount();
  }
}

function paintAvatar(el, addr) {
  const h = parseInt(addr.slice(2, 8), 16) % 360;
  el.style.background = `linear-gradient(135deg, hsl(${h} 75% 66%), hsl(${(h + 70) % 360} 70% 55%))`;
}

function renderAccount() {
  const connected = !!state.account;
  $("#accountDisconnected").hidden = connected;
  $("#accountConnected").hidden = !connected;

  const wb = $("#walletBtn");
  if (connected) {
    const signed = !!sessionFor(state.account);
    paintAvatar($("#acctAvatar"), state.account);
    $("#acctAddr").textContent = short(state.account);
    $("#acctAddr").title = state.account;
    const st = $("#acctStatus");
    st.textContent = signed ? t("signedIn") : t("notSigned");
    st.className = `mono ${signed ? "status-ok" : "status-no"}`;
    $("#signBtn").hidden = signed;

    const net = $("#netTag");
    net.hidden = state.chainOk === null;
    net.textContent = state.chainOk ? t("netOk") : t("netWrong");
    net.className = `tag ${state.chainOk ? "tag--proof" : "tag--warn"}`;
    $("#switchBtn").hidden = state.chainOk !== false;

    wb.innerHTML = `${signed ? '<i class="wallet-dot" aria-hidden="true"></i>' : ""}<span class="mono">${short(state.account)}</span>`;
    wb.className = "btn btn--ghost btn--sm";
    wb.title = state.account;
  } else {
    wb.textContent = t("connect");
    wb.className = "btn btn--primary btn--sm";
    wb.removeAttribute("title");
  }
}

/* =========================================================
   Positions: Blockscout (which NFTs) + chain (what's inside)
   ========================================================= */
async function fetchTokenIds(owner) {
  const ids = [];
  let next = null;
  for (let page = 0; page < 2 && ids.length < MAX_POSITIONS; page++) {
    const url = new URL(`${BLOCKSCOUT_API}/tokens/${CONTRACTS.positionManager}/instances`);
    url.searchParams.set("holder_address_hash", owner);
    if (next) Object.entries(next).forEach(([k, v]) => url.searchParams.set(k, v));
    const json = await fetchJson(url);
    for (const item of json.items || []) ids.push(BigInt(item.id));
    next = json.next_page_params;
    if (!next) break;
  }
  return { ids: ids.slice(0, MAX_POSITIONS), more: !!next || ids.length > MAX_POSITIONS };
}

async function readPositions(ids) {
  const PM = CONTRACTS.positionManager;
  const res = await client.multicall({
    ...MC,
    contracts: ids.flatMap((id) => [
      { address: PM, abi: pmAbi, functionName: "getPoolAndPositionInfo", args: [id] },
      { address: PM, abi: pmAbi, functionName: "getPositionLiquidity", args: [id] },
    ]),
  });

  const list = [];
  ids.forEach((id, i) => {
    const info = res[2 * i];
    if (info.status !== "success") return;
    const [key, packed] = info.result;
    if (!key.tickSpacing) return; // burned or never initialised
    const liq = res[2 * i + 1];
    list.push({
      id,
      key,
      tickLower: int24(packed >> 8n),
      tickUpper: int24(packed >> 32n),
      liquidity: liq.status === "success" ? liq.result : 0n,
      poolId: poolIdOf(key),
    });
  });

  // token symbols + decimals
  const meta = new Map([[ZERO, { symbol: "ETH", decimals: 18 }]]);
  const tokens = [...new Set(list.flatMap((p) => [p.key.currency0, p.key.currency1]).map((a) => a.toLowerCase()))].filter(
    (a) => a !== ZERO
  );
  if (tokens.length) {
    const r = await client.multicall({
      ...MC,
      contracts: tokens.flatMap((a) => [
        { address: a, abi: erc20Abi, functionName: "symbol" },
        { address: a, abi: erc20Abi, functionName: "decimals" },
      ]),
    });
    tokens.forEach((a, i) =>
      meta.set(a, {
        symbol: r[2 * i].status === "success" ? cleanSymbol(r[2 * i].result, a) : short(a),
        decimals: r[2 * i + 1].status === "success" ? Number(r[2 * i + 1].result) : 18,
      })
    );
  }

  // current tick per pool
  const pools = [...new Set(list.map((p) => p.poolId))];
  const slot = new Map();
  if (pools.length) {
    const r = await client.multicall({
      ...MC,
      contracts: pools.map((id) => ({ address: CONTRACTS.stateView, abi: svAbi, functionName: "getSlot0", args: [id] })),
    });
    pools.forEach((id, i) => {
      if (r[i].status === "success") slot.set(id, { tick: Number(r[i].result[1]), lpFee: Number(r[i].result[3]) });
    });
  }

  const order = { in: 0, below: 1, above: 1, unknown: 2, closed: 3 };
  return list
    .map((p) => {
      const s = slot.get(p.poolId);
      const tick = s ? s.tick : null;
      const status =
        p.liquidity === 0n ? "closed" : tick === null ? "unknown" : tick < p.tickLower ? "below" : tick >= p.tickUpper ? "above" : "in";
      return {
        ...p,
        t0: meta.get(p.key.currency0.toLowerCase()),
        t1: meta.get(p.key.currency1.toLowerCase()),
        tick,
        lpFee: s ? s.lpFee : null,
        status,
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || (b.id > a.id ? 1 : -1));
}

let loadSeq = 0;
async function loadPositions(owner, { updateUrl = true } = {}) {
  const seq = ++loadSeq;
  state.owner = getAddress(owner);
  state.loading = true;
  state.error = null;
  state.positions = null;
  if (updateUrl) {
    const u = new URL(location.href);
    u.searchParams.set("address", state.owner);
    history.replaceState(null, "", u);
  }
  renderPositions();
  try {
    const { ids, more } = await fetchTokenIds(state.owner);
    const positions = ids.length ? await readPositions(ids) : [];
    if (seq !== loadSeq) return;
    state.positions = positions;
    state.more = more;
  } catch (e) {
    if (seq !== loadSeq) return;
    console.error("RETRA: failed to load positions", e);
    state.error = e;
  } finally {
    if (seq === loadSeq) {
      state.loading = false;
      renderPositions();
    }
  }
}

function rangeBar(p) {
  if (p.tick === null) return "";
  const lo = p.tickLower;
  const hi = p.tickUpper;
  const span = Math.max(hi - lo, 1);
  // keep a far-away price on screen: clamp it to three range-widths outside
  const cur = Math.min(Math.max(p.tick, lo - 3 * span), hi + 3 * span);
  const min = Math.min(lo, cur) - span * 0.4;
  const max = Math.max(hi, cur) + span * 0.4;
  const pct = (x) => ((x - min) / (max - min)) * 100;
  return `<div class="rbar" aria-hidden="true"><span class="rbar__range" style="left:${pct(lo).toFixed(2)}%;width:${(
    pct(hi) - pct(lo)
  ).toFixed(2)}%"></span><span class="rbar__now" style="left:${pct(cur).toFixed(2)}%"></span></div>`;
}

function cardHtml(p) {
  const s0 = esc(p.t0.symbol);
  const s1 = esc(p.t1.symbol);
  const price = (tick) => Math.pow(1.0001, tick) * Math.pow(10, p.t0.decimals - p.t1.decimals);
  const dynamicFee = (p.key.fee & 0x800000) !== 0;
  const fee = dynamicFee ? `${t("dynamic")}${p.lpFee !== null ? ` · ${fmtFee(p.lpFee)}` : ""}` : fmtFee(p.key.fee);
  const hook = p.key.hooks.toLowerCase() === ZERO ? t("noHook") : short(p.key.hooks);
  const link = `${CHAIN.explorer}/token/${CONTRACTS.positionManager}/instance/${p.id}`;
  return `<article class="pos pos--${p.status}">
    <header class="pos__head">
      <div><strong class="pos__pair">${s0} / ${s1}</strong><span class="mono muted">#${p.id}</span></div>
      <span class="pill pill--${p.status}">${t(p.status)}</span>
    </header>
    ${rangeBar(p)}
    <dl class="pos__kv">
      <div><dt>${t("range")}</dt><dd class="mono">${fmtPrice(price(p.tickLower))} – ${fmtPrice(price(p.tickUpper))}</dd></div>
      <div><dt>${t("current")}</dt><dd class="mono">${p.tick === null ? "—" : fmtPrice(price(p.tick))}</dd></div>
      <div><dt>${t("fee")}</dt><dd class="mono">${fee}</dd></div>
      <div><dt>${t("hook")}</dt><dd class="mono"${hook === t("noHook") ? "" : ` title="${esc(p.key.hooks)}"`}>${hook}</dd></div>
    </dl>
    <p class="pos__unit mono muted">${t("unit", s1, s0)}</p>
    <footer class="pos__foot">
      <a href="${link}" target="_blank" rel="noopener">${t("explorer")}</a>
      <button type="button" class="btn btn--ghost btn--sm" disabled title="${esc(t("postSoon"))}">${t("post")} · ${t("soon")}</button>
    </footer>
  </article>`;
}

function renderPositions() {
  const grid = $("#posGrid");
  const empty = $("#posEmpty");
  const stats = $("#stats");
  const toggle = $("#closedToggle");
  $("#posOwner").textContent = state.owner ? t("ownerFor", state.owner) : "";

  const showEmpty = (html) => {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = html;
  };

  if (state.loading) {
    stats.innerHTML = "";
    toggle.hidden = true;
    empty.hidden = true;
    grid.innerHTML = '<div class="skel"></div>'.repeat(3);
    return;
  }
  if (state.error) {
    stats.innerHTML = "";
    toggle.hidden = true;
    showEmpty(`<p>${t("errLoad")}</p><button type="button" class="btn btn--ghost btn--sm" id="retryBtn">${t("retry")}</button>`);
    $("#retryBtn").addEventListener("click", () => loadPositions(state.owner, { updateUrl: false }));
    return;
  }
  if (!state.positions) {
    stats.innerHTML = "";
    toggle.hidden = true;
    showEmpty(`<p>${t("emptyStart")}</p>`);
    return;
  }

  const all = state.positions;
  const active = all.filter((p) => p.status !== "closed");
  const inRange = all.filter((p) => p.status === "in");
  stats.innerHTML = [
    [t("statTotal"), all.length],
    [t("statActive"), active.length],
    [t("statInRange"), inRange.length],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");

  const closedN = all.length - active.length;
  toggle.hidden = closedN === 0;
  $("#closedCount").textContent = `(${closedN})`;

  const visible = $("#showClosed").checked ? all : active;
  if (!all.length) return showEmpty(`<p>${t("emptyNone")}</p>`);
  if (!visible.length) return showEmpty(`<p>${t("emptyActive")}</p>`);
  empty.hidden = true;
  grid.innerHTML = visible.map(cardHtml).join("") + (state.more ? `<p class="fine">${t("more", MAX_POSITIONS)}</p>` : "");
}

/* =========================================================
   Language
   ========================================================= */
function setLang(next) {
  lang = next === "id" ? "id" : "en";
  document.documentElement.lang = lang;
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  renderAccount();
  renderPositions();
  if (msgKey) say(msgKey, $("#accountMsg").dataset.tone);
}

/* =========================================================
   Wire up
   ========================================================= */
$("#connectBtn").addEventListener("click", connect);
$("#signBtn").addEventListener("click", signIn);
$("#signOutBtn").addEventListener("click", signOut);
$("#switchBtn").addEventListener("click", switchNetwork);
$("#walletBtn").addEventListener("click", () => {
  if (!state.account) return connect();
  const done = () => toast(t("copied"));
  if (navigator.clipboard) navigator.clipboard.writeText(state.account).then(done, () => toast(state.account));
  else toast(state.account);
});
$("#showClosed").addEventListener("change", renderPositions);
$("#lookup").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#lookupInput").value.trim();
  if (!isAddress(v, { strict: false })) {
    $("#lookupErr").textContent = t("badAddr");
    return;
  }
  $("#lookupErr").textContent = "";
  loadPositions(v);
});
$("#lookupInput").addEventListener("input", () => ($("#lookupErr").textContent = ""));
$$(".lang button").forEach((b) =>
  b.addEventListener("click", () => {
    setLang(b.dataset.lang);
    try {
      localStorage.setItem("retra-lang", lang);
    } catch (e) {
      /* not remembered */
    }
  })
);

if (wallet()?.on) {
  wallet().on("accountsChanged", (accts) => {
    if (!state.account) return; // only follow the wallet while connected here
    setAccount(accts[0] || null);
  });
  wallet().on("chainChanged", () => refreshChain().then(renderAccount));
}

/* ---------- start ---------- */
(async function start() {
  let initialLang = null;
  try {
    initialLang = localStorage.getItem("retra-lang");
  } catch (e) {
    initialLang = null;
  }
  if (initialLang !== "en" && initialLang !== "id") initialLang = /^id\b/i.test(navigator.language || "") ? "id" : "en";
  setLang(initialLang);

  state.session = loadSession();
  const param = new URL(location.href).searchParams.get("address");

  // Restore a remembered sign-in without a wallet popup (eth_accounts never prompts).
  if (state.session && wallet()) {
    try {
      const accts = (await wallet().request({ method: "eth_accounts" })).map((a) => getAddress(a));
      if (accts.includes(state.session.address)) {
        await setAccount(state.session.address);
        if (param && isAddress(param, { strict: false }) && getAddress(param) !== state.account) loadPositions(param, { updateUrl: false });
        return;
      }
    } catch (e) {
      /* wallet unavailable: fall through */
    }
  }
  if (param && isAddress(param, { strict: false })) {
    $("#lookupInput").value = param;
    loadPositions(param, { updateUrl: false });
  }
  renderAccount();
})();
