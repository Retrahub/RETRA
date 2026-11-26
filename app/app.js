/*
 * RETRA app — Callouts Lite
 *   Week 1: wallet sign-in + Uniswap v4 positions on Robinhood Chain (read-only)
 *   Week 2: server-verified sign-in, post a position as a callout, public feed
 * This page never sends a transaction. Signing in is one EIP-191 message signature.
 */
import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  fallback,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  stringToHex,
  verifyMessage,
} from "https://cdn.jsdelivr.net/npm/viem@2.39.3/+esm";
import { API_URL, BLOCKSCOUT_API, CHAIN, CONTRACTS, MAX_POSITIONS, SESSION_HOURS } from "./chain.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const ZERO = "0x0000000000000000000000000000000000000000";
const MAX_TEXT = 280;

/* =========================================================
   Text (EN / ID). The language choice is shared with the home page.
   ========================================================= */
const STR = {
  en: {
    eyebrow: "Week 2 preview",
    title: "Every LP position is a post",
    lead: "Sign in with your wallet, pick one of your open Uniswap v4 positions on Robinhood Chain and post it as a callout. Every card is checked against the chain.",
    signinTitle: "Sign in with your wallet",
    signinBody: "One signature proves the wallet is yours. No gas, no approval.",
    connect: "Connect wallet",
    connecting: "Waiting for your wallet…",
    signIn: "Sign in",
    signing: "Check your wallet and sign the message…",
    signOut: "Sign out",
    signedIn: "Signed in",
    notSigned: "Connected · not signed in",
    signedInMsg: "Signed in. You can now post your open positions.",
    signedInLocal: "Signed in on this device. The RETRA server isn't live yet, so posting is off for now.",
    signedOutMsg: "Signed out of RETRA. To fully disconnect, remove this site in your wallet's connected sites.",
    sessionExpired: "Your sign-in expired. Sign in again to post.",
    netOk: "Robinhood Chain",
    netWrong: "Other network",
    switchNet: "Switch to Robinhood Chain",
    noWallet: "No wallet found in this browser. Install MetaMask or Rabby, or browse the feed and positions without one.",
    rejected: "Request cancelled in your wallet.",
    pending: "Your wallet already has a request open. Open the wallet to finish or cancel it.",
    sigBad: "That signature doesn't match this wallet. Try signing in again.",
    tabFeed: "Feed",
    tabPositions: "My positions",
    feedTitle: "Latest callouts",
    feedSub: "Every callout is tied to a real position. Status and price update live from the chain.",
    refresh: "Refresh",
    loadMore: "Load more",
    feedEmpty: "No callouts yet. Sign in, open “My positions” and post the first one.",
    feedErr: "Couldn't load the feed. Try again in a minute.",
    feedOff: "The RETRA server isn't live yet, so the feed is empty for now. You can already sign in and look at positions.",
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
    atPost: "At post → now",
    fee: "Fee",
    hook: "Hook",
    noHook: "None",
    dynamic: "Dynamic",
    unit: (quote, base) => `Prices in ${quote} per ${base}`,
    post: "Post callout",
    posted: "Posted ✓",
    signInToPost: "Sign in to post",
    tail: "Tail",
    tailSoon: "Tailing arrives in week 4",
    week4: "week 4",
    more: (n) => `Showing the first ${n} positions.`,
    explorer: "View on explorer ↗",
    copied: "Address copied",
    composeTitle: "Post a callout",
    composeLabel: "Your play",
    composeHint: "Links and wallet or contract addresses are blocked to keep readers safe from phishing.",
    composePlaceholder: "e.g. Tight range around spot, farming fees while it chops.",
    cancel: "Cancel",
    postBtn: "Post",
    postingBtn: "Posting…",
    postedToast: "Callout posted",
    err_links_blocked: "Links and wallet or contract addresses can't be posted. Remove them and try again.",
    err_too_long: "Keep it to 280 characters.",
    err_empty_text: "Write a few words about your play.",
    err_position_closed: "This position is closed. Only open positions can be posted.",
    err_not_owner: "Only the wallet that holds this position can post it.",
    err_already_posted: "This position already has a callout.",
    err_rate_limited: "You can post up to 10 callouts an hour. Try again later.",
    err_signed_out: "Your sign-in expired. Sign in again to post.",
    err_no_position: "That position doesn't exist on Robinhood Chain.",
    err_network: "Couldn't reach the RETRA server. Check your connection and try again.",
    back: "← Back to the RETRA home page",
    footer: "Data is read live from Robinhood Chain (public RPC), Blockscout and Uniswap v4. LP positions can lose value. Tailing copies a range, not a result. Nothing here is financial advice.",
  },
  id: {
    eyebrow: "Pratinjau minggu 2",
    title: "Setiap posisi LP adalah postingan",
    lead: "Masuk dengan wallet, pilih salah satu posisi Uniswap v4 kamu yang masih terbuka di Robinhood Chain, lalu posting sebagai callout. Setiap kartu dicek langsung ke chain.",
    signinTitle: "Masuk dengan wallet",
    signinBody: "Satu tanda tangan membuktikan wallet ini milikmu. Tanpa gas, tanpa approval.",
    connect: "Hubungkan wallet",
    connecting: "Menunggu wallet kamu…",
    signIn: "Masuk",
    signing: "Buka wallet kamu dan tanda tangani pesannya…",
    signOut: "Keluar",
    signedIn: "Sudah masuk",
    notSigned: "Terhubung · belum masuk",
    signedInMsg: "Berhasil masuk. Sekarang kamu bisa memposting posisi yang masih terbuka.",
    signedInLocal: "Berhasil masuk di perangkat ini. Server RETRA belum aktif, jadi posting belum bisa.",
    signedOutMsg: "Sudah keluar dari RETRA. Untuk memutus sepenuhnya, hapus situs ini dari daftar situs terhubung di wallet kamu.",
    sessionExpired: "Sesi masukmu sudah habis. Masuk lagi untuk posting.",
    netOk: "Robinhood Chain",
    netWrong: "Jaringan lain",
    switchNet: "Pindah ke Robinhood Chain",
    noWallet: "Tidak ada wallet di browser ini. Pasang MetaMask atau Rabby, atau lihat-lihat feed dan posisi tanpa wallet.",
    rejected: "Permintaan dibatalkan di wallet.",
    pending: "Masih ada permintaan yang terbuka di wallet kamu. Buka wallet untuk menyelesaikan atau membatalkannya.",
    sigBad: "Tanda tangan tidak cocok dengan wallet ini. Coba masuk lagi.",
    tabFeed: "Feed",
    tabPositions: "Posisi saya",
    feedTitle: "Callout terbaru",
    feedSub: "Setiap callout terikat ke posisi nyata. Status dan harga diperbarui langsung dari chain.",
    refresh: "Muat ulang",
    loadMore: "Muat lagi",
    feedEmpty: "Belum ada callout. Masuk, buka “Posisi saya”, lalu posting yang pertama.",
    feedErr: "Feed belum bisa dimuat. Coba lagi sebentar lagi.",
    feedOff: "Server RETRA belum aktif, jadi feed masih kosong. Kamu sudah bisa masuk dan melihat posisi.",
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
    atPost: "Saat posting → sekarang",
    fee: "Fee",
    hook: "Hook",
    noHook: "Tidak ada",
    dynamic: "Dinamis",
    unit: (quote, base) => `Harga dalam ${quote} per ${base}`,
    post: "Posting callout",
    posted: "Sudah diposting ✓",
    signInToPost: "Masuk untuk posting",
    tail: "Tail",
    tailSoon: "Fitur tail hadir di minggu 4",
    week4: "minggu 4",
    more: (n) => `Menampilkan ${n} posisi pertama.`,
    explorer: "Lihat di explorer ↗",
    copied: "Alamat disalin",
    composeTitle: "Posting callout",
    composeLabel: "Strategimu",
    composeHint: "Link serta alamat wallet atau kontrak diblokir supaya pembaca aman dari phishing.",
    composePlaceholder: "mis. Range sempit di sekitar spot, panen fee selagi harga sideways.",
    cancel: "Batal",
    postBtn: "Posting",
    postingBtn: "Memposting…",
    postedToast: "Callout diposting",
    err_links_blocked: "Link serta alamat wallet atau kontrak tidak bisa diposting. Hapus dulu lalu coba lagi.",
    err_too_long: "Maksimal 280 karakter.",
    err_empty_text: "Tulis beberapa kata tentang strategimu.",
    err_position_closed: "Posisi ini sudah ditutup. Hanya posisi yang masih terbuka yang bisa diposting.",
    err_not_owner: "Hanya wallet pemilik posisi ini yang bisa mempostingnya.",
    err_already_posted: "Posisi ini sudah punya callout.",
    err_rate_limited: "Maksimal 10 callout per jam. Coba lagi nanti.",
    err_signed_out: "Sesi masukmu sudah habis. Masuk lagi untuk posting.",
    err_no_position: "Posisi itu tidak ada di Robinhood Chain.",
    err_network: "Tidak bisa menghubungi server RETRA. Cek koneksi lalu coba lagi.",
    back: "← Kembali ke beranda RETRA",
    footer: "Data dibaca langsung dari Robinhood Chain (RPC publik), Blockscout, dan Uniswap v4. Posisi LP bisa rugi. Tail menyalin range, bukan hasil. Tidak ada isi halaman ini yang merupakan nasihat keuangan.",
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
const priceAt = (tick, d0, d1) => Math.pow(1.0001, tick) * Math.pow(10, d0 - d1);
function timeAgo(iso) {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  const steps = [
    [60, "second"],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [604800, "day", 86400],
    [Infinity, "week", 604800],
  ];
  for (const [limit, unit, div = 1] of steps) if (Math.abs(s) < limit) return rtf.format(Math.round(s / div), unit);
  return "";
}
function avatarStyle(addr) {
  const h = parseInt(addr.slice(2, 8), 16) % 360;
  return `background:linear-gradient(135deg, hsl(${h} 75% 66%), hsl(${(h + 70) % 360} 70% 55%))`;
}

const toastEl = $("#toast");
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
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

/* ---------- RETRA API ---------- */
class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
async function api(method, path, body, { auth = false, ms = 20000 } = {}) {
  if (!API_URL) throw new ApiError("offline", "API not configured", 0);
  const headers = { accept: "application/json" };
  if (body) headers["content-type"] = "application/json";
  if (auth && state.session?.token) headers.authorization = `Bearer ${state.session.token}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
  } catch (e) {
    throw new ApiError("network", e.message, 0);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "server_error", data.message || `HTTP ${res.status}`, res.status);
  return data;
}
const apiMessage = (e) => (STR.en[`err_${e.code}`] ? t(`err_${e.code}`) : e.code === "offline" ? t("feedOff") : e.message);

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
const client = createPublicClient({
  chain,
  transport: fallback([CHAIN.rpc, CHAIN.rpcFallback].filter(Boolean).map((u) => http(u, { timeout: 20000, retryCount: 1 }))),
});

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
const statusOf = (liquidity, tick, lo, hi) =>
  liquidity === 0n ? "closed" : tick === null ? "unknown" : tick < lo ? "below" : tick >= hi ? "above" : "in";

/* =========================================================
   State
   ========================================================= */
const state = {
  account: null, // checksummed address the wallet gave us
  chainOk: null, // true / false / null (unknown)
  session: null, // server: { address, token, expiresAt } · local only: { address, issuedAt }
  busy: false,
  view: "feed",
  owner: null, // address whose positions are on screen
  positions: null,
  more: false,
  loading: false,
  error: null,
  postedIds: new Set(), // token ids the signed-in wallet already posted
  feed: { items: [], next: null, loading: false, error: null, loaded: false },
};

/* ---------- session (remembered sign-in) ---------- */
const SESSION_KEY = "retra-session";
function sessionValid(s) {
  if (!s || !s.address) return false;
  if (s.expiresAt) return Date.parse(s.expiresAt) > Date.now();
  return Date.now() - Date.parse(s.issuedAt) < SESSION_HOURS * 3600e3;
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (sessionValid(s)) return s;
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
const canPost = () => !!(state.session?.token && state.account && state.session.address === state.account);

/* =========================================================
   Wallet: connect, sign in, network
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
  if (e instanceof ApiError) return setMsg(apiMessage(e), "error");
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
  if (state.account) {
    loadPostedIds();
    loadPositions(state.account, { updateUrl: false });
  }
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

function buildMessage(address, nonce) {
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
    if (API_URL) {
      // Server sign-in: one-time nonce from the API, signature checked on the server.
      const { nonce } = await api("POST", "/auth/nonce");
      const { message } = buildMessage(address, nonce);
      const signature = await wallet().request({ method: "personal_sign", params: [stringToHex(message), address] });
      const s = await api("POST", "/auth/verify", { message, signature });
      state.session = { address: getAddress(s.address), token: s.token, expiresAt: s.expiresAt };
      saveSession(state.session);
      say("signedInMsg", "ok");
      loadPostedIds();
    } else {
      // No server yet: prove ownership locally only.
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
      const { message, issuedAt } = buildMessage(address, nonce);
      const signature = await wallet().request({ method: "personal_sign", params: [stringToHex(message), address] });
      const ok =
        (await verifyMessage({ address, message, signature }).catch(() => false)) ||
        (await client.verifyMessage({ address, message, signature }).catch(() => false));
      if (!ok) return say("sigBad", "error");
      state.session = { address, issuedAt };
      saveSession(state.session);
      say("signedInLocal", "ok");
    }
  } catch (e) {
    walletError(e);
  } finally {
    setBusy(false);
    renderAccount();
    renderPositions();
  }
}

function signOut() {
  if (state.session?.token) api("POST", "/auth/logout", null, { auth: true }).catch(() => {});
  state.session = null;
  saveSession(null);
  state.account = null;
  state.chainOk = null;
  state.postedIds = new Set();
  renderAccount();
  renderPositions();
  say("signedOutMsg");
}

function expireSession() {
  state.session = null;
  saveSession(null);
  renderAccount();
  renderPositions();
  say("sessionExpired", "warn");
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

function renderAccount() {
  const connected = !!state.account;
  $("#accountDisconnected").hidden = connected;
  $("#accountConnected").hidden = !connected;

  const wb = $("#walletBtn");
  if (connected) {
    const signed = !!sessionFor(state.account);
    $("#acctAvatar").setAttribute("style", avatarStyle(state.account));
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
   Shared card pieces
   ========================================================= */
function rangeBar(lo, hi, tick) {
  if (tick === null || tick === undefined) return "";
  const span = Math.max(hi - lo, 1);
  // keep a far-away price on screen: clamp it to three range-widths outside
  const cur = Math.min(Math.max(tick, lo - 3 * span), hi + 3 * span);
  const min = Math.min(lo, cur) - span * 0.4;
  const max = Math.max(hi, cur) + span * 0.4;
  const pct = (x) => ((x - min) / (max - min)) * 100;
  return `<div class="rbar" aria-hidden="true"><span class="rbar__range" style="left:${pct(lo).toFixed(2)}%;width:${(
    pct(hi) - pct(lo)
  ).toFixed(2)}%"></span><span class="rbar__now" style="left:${pct(cur).toFixed(2)}%"></span></div>`;
}
function feeLabel(fee, lpFee) {
  return (fee & 0x800000) !== 0 ? `${t("dynamic")}${lpFee != null ? ` · ${fmtFee(lpFee)}` : ""}` : fmtFee(fee);
}
const explorerLink = (id) => `${CHAIN.explorer}/token/${CONTRACTS.positionManager}/instance/${id}`;

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

  const slot = await readSlots(list.map((p) => p.poolId));
  const order = { in: 0, below: 1, above: 1, unknown: 2, closed: 3 };
  return list
    .map((p) => {
      const s = slot.get(p.poolId);
      const tick = s ? s.tick : null;
      return {
        ...p,
        t0: meta.get(p.key.currency0.toLowerCase()),
        t1: meta.get(p.key.currency1.toLowerCase()),
        tick,
        lpFee: s ? s.lpFee : null,
        status: statusOf(p.liquidity, tick, p.tickLower, p.tickUpper),
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || (b.id > a.id ? 1 : -1));
}

async function readSlots(poolIds) {
  const pools = [...new Set(poolIds)];
  const slot = new Map();
  if (!pools.length) return slot;
  const r = await client.multicall({
    ...MC,
    contracts: pools.map((id) => ({ address: CONTRACTS.stateView, abi: svAbi, functionName: "getSlot0", args: [id] })),
  });
  pools.forEach((id, i) => {
    if (r[i].status === "success") slot.set(id, { tick: Number(r[i].result[1]), lpFee: Number(r[i].result[3]) });
  });
  return slot;
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
    u.hash = "positions";
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

async function loadPostedIds() {
  if (!API_URL || !state.account) return;
  try {
    const { items } = await api("GET", `/callouts?limit=50&address=${state.account}`);
    state.postedIds = new Set(items.map((c) => c.tokenId));
    renderPositions();
  } catch (e) {
    /* not critical: the server still refuses a second post */
  }
}

function postButton(p) {
  const own = state.account && state.owner === state.account;
  if (!own || p.status === "closed" || !API_URL) return "";
  if (state.postedIds.has(String(p.id))) {
    return `<button type="button" class="btn btn--ghost btn--sm btn--posted" disabled>${t("posted")}</button>`;
  }
  if (!canPost()) return `<button type="button" class="btn btn--ghost btn--sm" data-signin>${t("signInToPost")}</button>`;
  return `<button type="button" class="btn btn--callouts btn--sm" data-post="${p.id}">${t("post")}</button>`;
}

function cardHtml(p) {
  const s0 = esc(p.t0.symbol);
  const s1 = esc(p.t1.symbol);
  const price = (tick) => priceAt(tick, p.t0.decimals, p.t1.decimals);
  const hook = p.key.hooks.toLowerCase() === ZERO ? t("noHook") : short(p.key.hooks);
  return `<article class="pos pos--${p.status}">
    <header class="pos__head">
      <div><strong class="pos__pair">${s0} / ${s1}</strong><span class="mono muted">#${p.id}</span></div>
      <span class="pill pill--${p.status}">${t(p.status)}</span>
    </header>
    ${rangeBar(p.tickLower, p.tickUpper, p.tick)}
    <dl class="pos__kv">
      <div><dt>${t("range")}</dt><dd class="mono">${fmtPrice(price(p.tickLower))} – ${fmtPrice(price(p.tickUpper))}</dd></div>
      <div><dt>${t("current")}</dt><dd class="mono">${p.tick === null ? "—" : fmtPrice(price(p.tick))}</dd></div>
      <div><dt>${t("fee")}</dt><dd class="mono">${feeLabel(p.key.fee, p.lpFee)}</dd></div>
      <div><dt>${t("hook")}</dt><dd class="mono"${hook === t("noHook") ? "" : ` title="${esc(p.key.hooks)}"`}>${hook}</dd></div>
    </dl>
    <p class="pos__unit mono muted">${t("unit", s1, s0)}</p>
    <footer class="pos__foot">
      <a href="${explorerLink(p.id)}" target="_blank" rel="noopener">${t("explorer")}</a>
      ${postButton(p)}
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
    showEmpty(`<p>${t("errLoad")}</p><button type="button" class="btn btn--ghost btn--sm" data-retry-positions>${t("retry")}</button>`);
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
   Feed
   ========================================================= */
async function withLiveStatus(items) {
  if (!items.length) return items;
  try {
    const [liq, slots] = await Promise.all([
      client.multicall({
        ...MC,
        contracts: items.map((c) => ({
          address: CONTRACTS.positionManager,
          abi: pmAbi,
          functionName: "getPositionLiquidity",
          args: [BigInt(c.tokenId)],
        })),
      }),
      readSlots(items.map((c) => c.poolId)),
    ]);
    return items.map((c, i) => {
      const s = slots.get(c.poolId);
      const tick = s ? s.tick : null;
      const liquidity = liq[i].status === "success" ? liq[i].result : null;
      return {
        ...c,
        tick,
        lpFee: s ? s.lpFee : null,
        status: liquidity === null ? "unknown" : statusOf(liquidity, tick, c.tickLower, c.tickUpper),
      };
    });
  } catch (e) {
    console.error("RETRA: live status failed", e);
    return items.map((c) => ({ ...c, tick: null, lpFee: null, status: "unknown" }));
  }
}

async function loadFeed({ append = false } = {}) {
  const f = state.feed;
  if (f.loading) return;
  f.loading = true;
  f.error = null;
  if (!append) {
    f.items = [];
    f.next = null;
  }
  renderFeed();
  try {
    const q = new URLSearchParams({ limit: "20" });
    if (append && f.next) q.set("before", String(f.next));
    const { items, next } = await api("GET", `/callouts?${q}`);
    const live = await withLiveStatus(items);
    f.items = append ? f.items.concat(live) : live;
    f.next = next;
  } catch (e) {
    f.error = e;
  } finally {
    f.loading = false;
    f.loaded = true;
    renderFeed();
  }
}

function calloutHtml(c) {
  const s0 = esc(c.token0.symbol);
  const s1 = esc(c.token1.symbol);
  const price = (tick) => priceAt(tick, c.token0.decimals, c.token1.decimals);
  const who = `?address=${c.address}#positions`;
  const atPost = c.tickAtPost === null ? "—" : fmtPrice(price(c.tickAtPost));
  const now = c.tick === null ? "—" : fmtPrice(price(c.tick));
  return `<article class="cc cc--${c.status}">
    <header class="cc__head">
      <span class="cc__avatar" style="${avatarStyle(c.address)}" aria-hidden="true"></span>
      <div class="cc__who"><a class="mono" href="${who}" title="${esc(c.address)}">${short(c.address)}</a><span class="mono muted">${timeAgo(c.createdAt)}</span></div>
      <span class="pill pill--${c.status}">${t(c.status)}</span>
    </header>
    <p class="cc__text">${esc(c.text)}</p>
    <div class="cc__pos"><strong>${s0} / ${s1}</strong><span class="mono muted">#${esc(c.tokenId)} · ${feeLabel(c.pool.fee, c.lpFee)}</span></div>
    ${rangeBar(c.tickLower, c.tickUpper, c.tick)}
    <dl class="pos__kv">
      <div><dt>${t("range")}</dt><dd class="mono">${fmtPrice(price(c.tickLower))} – ${fmtPrice(price(c.tickUpper))}</dd></div>
      <div><dt>${t("atPost")}</dt><dd class="mono">${atPost} → ${now}</dd></div>
      <div><dt>${t("fee")}</dt><dd class="mono">${feeLabel(c.pool.fee, c.lpFee)}</dd></div>
    </dl>
    <p class="pos__unit mono muted">${t("unit", s1, s0)}</p>
    <footer class="pos__foot">
      <a href="${explorerLink(esc(c.tokenId))}" target="_blank" rel="noopener">${t("explorer")}</a>
      <button type="button" class="btn btn--ghost btn--sm" disabled title="${esc(t("tailSoon"))}">${t("tail")} · ${t("week4")}</button>
    </footer>
  </article>`;
}

function renderFeed() {
  const f = state.feed;
  const list = $("#feedList");
  const empty = $("#feedEmpty");
  const more = $("#feedMore");
  more.hidden = !f.next || f.loading;

  if (!API_URL) {
    list.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = `<p>${t("feedOff")}</p>`;
    return;
  }
  if (f.loading && !f.items.length) {
    empty.hidden = true;
    list.innerHTML = '<div class="skel skel--short"></div>'.repeat(2);
    return;
  }
  if (f.error && !f.items.length) {
    list.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = `<p>${f.error.code === "network" ? t("err_network") : t("feedErr")}</p><button type="button" class="btn btn--ghost btn--sm" data-retry-feed>${t("retry")}</button>`;
    return;
  }
  if (!f.items.length) {
    list.innerHTML = "";
    empty.hidden = !f.loaded;
    empty.innerHTML = `<p>${t("feedEmpty")}</p>`;
    return;
  }
  empty.hidden = true;
  list.innerHTML = f.items.map(calloutHtml).join("");
}

/* =========================================================
   Composer
   ========================================================= */
const composer = $("#composer");
let composing = null;

function openComposer(tokenId) {
  const p = state.positions?.find((x) => String(x.id) === String(tokenId));
  if (!p) return;
  composing = p;
  $("#composePos").innerHTML = `<strong>${esc(p.t0.symbol)} / ${esc(p.t1.symbol)}</strong><span class="mono muted">#${p.id} · ${t(
    p.status
  )}</span>`;
  const ta = $("#composeText");
  ta.value = "";
  ta.placeholder = t("composePlaceholder");
  $("#composeErr").textContent = "";
  updateCount();
  setComposeBusy(false);
  composer.showModal();
  ta.focus();
}
function closeComposer() {
  composing = null;
  composer.close();
}
function updateCount() {
  const n = [...$("#composeText").value.replace(/\s+/g, " ").trim()].length;
  const el = $("#composeCount");
  el.textContent = String(MAX_TEXT - n);
  el.classList.toggle("over", n > MAX_TEXT);
}
function setComposeBusy(on) {
  $("#composeSubmit").disabled = on;
  $("#composeSubmit").textContent = on ? t("postingBtn") : t("postBtn");
}

async function submitCallout(e) {
  e.preventDefault();
  if (!composing) return;
  const text = $("#composeText").value.replace(/\s+/g, " ").trim();
  if (!text) return ($("#composeErr").textContent = t("err_empty_text"));
  if ([...text].length > MAX_TEXT) return ($("#composeErr").textContent = t("err_too_long"));
  setComposeBusy(true);
  $("#composeErr").textContent = "";
  try {
    await api("POST", "/callouts", { tokenId: String(composing.id), text }, { auth: true });
    state.postedIds.add(String(composing.id));
    closeComposer();
    toast(t("postedToast"));
    renderPositions();
    state.feed.loaded = false;
    go("feed");
  } catch (err) {
    if (err.code === "signed_out") {
      closeComposer();
      return expireSession();
    }
    if (err.code === "already_posted") state.postedIds.add(String(composing.id));
    $("#composeErr").textContent = apiMessage(err);
  } finally {
    setComposeBusy(false);
  }
}

/* =========================================================
   Views (#feed / #positions)
   ========================================================= */
function go(view) {
  const next = view === "positions" ? "positions" : "feed";
  if (location.hash !== `#${next}`) history.replaceState(null, "", `${location.pathname}${location.search}#${next}`);
  showView(next);
}
function showView(view) {
  state.view = view;
  $("#viewFeed").hidden = view !== "feed";
  $("#viewPositions").hidden = view !== "positions";
  $$(".tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.view === view)));
  if (view === "feed" && !state.feed.loaded && API_URL) loadFeed();
  if (view === "feed") renderFeed();
}

/* =========================================================
   Language
   ========================================================= */
function setLang(next) {
  lang = next === "id" ? "id" : "en";
  document.documentElement.lang = lang;
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $("#composeText").placeholder = t("composePlaceholder");
  renderAccount();
  renderPositions();
  renderFeed();
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
$("#posGrid").addEventListener("click", (e) => {
  const post = e.target.closest("[data-post]");
  if (post) return openComposer(post.dataset.post);
  if (e.target.closest("[data-signin]")) signIn();
});
$("#posEmpty").addEventListener("click", (e) => {
  if (e.target.closest("[data-retry-positions]") && state.owner) loadPositions(state.owner, { updateUrl: false });
});
$("#feedEmpty").addEventListener("click", (e) => {
  if (e.target.closest("[data-retry-feed]")) loadFeed();
});
$("#feedRefresh").addEventListener("click", () => loadFeed());
$("#feedMore").addEventListener("click", () => loadFeed({ append: true }));
$("#feedList").addEventListener("click", (e) => {
  const a = e.target.closest(".cc__who a");
  if (!a) return;
  e.preventDefault();
  const addr = new URL(a.href).searchParams.get("address");
  $("#lookupInput").value = addr;
  loadPositions(addr);
  showView("positions");
  window.scrollTo({ top: $(".tabs").offsetTop - 80, behavior: "smooth" });
});
$$(".tab").forEach((tab) =>
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    go(tab.dataset.view);
  })
);
window.addEventListener("hashchange", () => showView(location.hash === "#positions" ? "positions" : "feed"));
$("#composeForm").addEventListener("submit", submitCallout);
$("#composeText").addEventListener("input", () => {
  updateCount();
  $("#composeErr").textContent = "";
});
$("#composeCancel").addEventListener("click", closeComposer);
$("#composeClose").addEventListener("click", closeComposer);
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

// Local development only: lets tests inspect state. Never exposed on the live site.
if (["localhost", "127.0.0.1"].includes(location.hostname)) window.__retraDebug = { state, renderPositions };

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

  const param = new URL(location.href).searchParams.get("address");
  showView(location.hash === "#positions" || (param && location.hash !== "#feed") ? "positions" : "feed");

  state.session = loadSession();
  // A server session must still be accepted by the API.
  if (state.session?.token) {
    try {
      await api("GET", "/me", null, { auth: true });
    } catch (e) {
      if (e.code === "signed_out") {
        state.session = null;
        saveSession(null);
      }
    }
  }

  // Restore a remembered sign-in without a wallet popup (eth_accounts never prompts).
  if (state.session && wallet()) {
    try {
      const accts = (await wallet().request({ method: "eth_accounts" })).map((a) => getAddress(a));
      if (accts.includes(state.session.address)) {
        await setAccount(state.session.address);
        if (param && isAddress(param, { strict: false }) && getAddress(param) !== state.account) {
          $("#lookupInput").value = param;
          loadPositions(param, { updateUrl: false });
        }
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
