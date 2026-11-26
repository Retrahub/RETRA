/*
 * RETRA API — Cloudflare Worker + D1
 *
 *   GET  /health          liveness check
 *   POST /auth/nonce      → { nonce }                      one-time, 10 minutes
 *   POST /auth/verify     { message, signature } → { token, address, expiresAt }
 *   POST /auth/logout     (Bearer) ends the session
 *   GET  /me              (Bearer) → { address }
 *   GET  /callouts        ?limit=20&before=<id>&address=<0x…> → { items, next }
 *   POST /callouts        (Bearer) { tokenId, text } → callout
 *
 * The server never holds funds or keys. It checks every callout against the chain:
 * the signed-in wallet must own the Uniswap v4 position and it must still hold liquidity.
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
  verifyMessage,
} from "viem";

const CHAIN_ID = 4663;
const PM = "0x58daec3116aae6d93017baaea7749052e8a04fa7"; // Uniswap v4 PositionManager
const SV = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b"; // Uniswap v4 StateView
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const ZERO = "0x0000000000000000000000000000000000000000";

const NONCE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT = 280;
const HOURLY_LIMIT = 10;

const pmAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)",
]);
const svAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

/* ---------- helpers ---------- */
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const now = () => Date.now();
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(text) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}
const int24 = (x) => {
  const n = Number(BigInt(x) & 0xffffffn);
  return n >= 0x800000 ? n - 0x1000000 : n;
};
const cleanSymbol = (s, addr) => {
  const v = String(s || "").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 14);
  return v || `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};
const poolIdOf = (k) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
      [k.currency0, k.currency1, k.fee, k.tickSpacing, k.hooks]
    )
  );

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "bad_json", "The request body must be JSON.");
  }
}

const allowedOrigins = (env) =>
  String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function corsHeaders(req, env) {
  const h = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
  const origin = req.headers.get("origin");
  if (origin && allowedOrigins(env).includes(origin)) h["access-control-allow-origin"] = origin;
  return h;
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

let cachedClient;
function chainClient(env) {
  if (!cachedClient) {
    const chain = defineChain({
      id: CHAIN_ID,
      name: "Robinhood Chain",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.RPC_URL] } },
      contracts: { multicall3: { address: MULTICALL3 } },
    });
    cachedClient = createPublicClient({ chain, transport: http(env.RPC_URL, { timeout: 15000, retryCount: 2 }) });
  }
  return cachedClient;
}

/* ---------- auth ---------- */
async function createNonce(env) {
  const nonce = randomHex(16);
  const t = now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM nonces WHERE created_at < ?").bind(t - NONCE_TTL_MS),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t),
    env.DB.prepare("INSERT INTO nonces (nonce, created_at) VALUES (?, ?)").bind(nonce, t),
  ]);
  return { nonce };
}

// Reads the Sign-In-with-Ethereum style message the app builds (EIP-4361 layout).
function parseMessage(message) {
  const lines = String(message).split("\n");
  const head = /^(.+) wants you to sign in with your Ethereum account:$/.exec(lines[0] || "");
  const field = (name) => {
    const line = lines.find((l) => l.startsWith(`${name}: `));
    return line ? line.slice(name.length + 2).trim() : "";
  };
  return {
    domain: head ? head[1] : "",
    address: (lines[1] || "").trim(),
    uri: field("URI"),
    chainId: Number(field("Chain ID")),
    nonce: field("Nonce"),
    issuedAt: Date.parse(field("Issued At")),
  };
}

async function verifySignIn(req, env) {
  const { message, signature } = await readJson(req);
  if (typeof message !== "string" || message.length > 2000 || !/^0x[0-9a-fA-F]+$/.test(signature || "")) {
    throw new HttpError(400, "bad_request", "Send the signed message and its signature.");
  }
  const m = parseMessage(message);
  const hosts = allowedOrigins(env).map((o) => new URL(o).host);
  if (!hosts.includes(m.domain)) throw new HttpError(400, "bad_domain", "This sign-in message is for a different site.");
  if (!isAddress(m.address)) throw new HttpError(400, "bad_address", "The message has no valid wallet address.");
  if (m.chainId !== CHAIN_ID) throw new HttpError(400, "bad_chain", "The message must be for Robinhood Chain (4663).");
  if (!Number.isFinite(m.issuedAt) || Math.abs(now() - m.issuedAt) > NONCE_TTL_MS) {
    throw new HttpError(400, "expired", "This sign-in message is too old. Sign in again.");
  }

  // Use the nonce exactly once.
  const used = await env.DB.prepare("DELETE FROM nonces WHERE nonce = ? AND created_at >= ? RETURNING nonce")
    .bind(m.nonce, now() - NONCE_TTL_MS)
    .first();
  if (!used) throw new HttpError(400, "bad_nonce", "This sign-in request expired or was already used. Sign in again.");

  const address = getAddress(m.address);
  const ok =
    (await verifyMessage({ address, message, signature }).catch(() => false)) ||
    (await chainClient(env).verifyMessage({ address, message, signature }).catch(() => false));
  if (!ok) throw new HttpError(401, "bad_signature", "The signature doesn't match this wallet.");

  const token = randomHex(32);
  const t = now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, address, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), address, t, t + SESSION_TTL_MS)
    .run();
  return { token, address, expiresAt: new Date(t + SESSION_TTL_MS).toISOString() };
}

async function requireSession(req, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("authorization") || "");
  if (!m) throw new HttpError(401, "signed_out", "Sign in with your wallet first.");
  const row = await env.DB.prepare("SELECT address FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256(m[1]), now())
    .first();
  if (!row) throw new HttpError(401, "signed_out", "Your sign-in expired. Sign in with your wallet again.");
  return { address: row.address, tokenHash: await sha256(m[1]) };
}

async function logout(req, env) {
  const s = await requireSession(req, env);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(s.tokenHash).run();
  return { ok: true };
}

/* ---------- callouts ---------- */
const LINKS = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|app|gg|me|co|tech|finance|fi|exchange)\b|0x[0-9a-f]{8,})/i;

function format(r) {
  return {
    id: r.id,
    address: r.address,
    tokenId: r.token_id,
    poolId: r.pool_id,
    pool: { currency0: r.currency0, currency1: r.currency1, fee: r.fee, tickSpacing: r.tick_spacing, hooks: r.hooks },
    token0: { address: r.currency0, symbol: r.symbol0, decimals: r.decimals0 },
    token1: { address: r.currency1, symbol: r.symbol1, decimals: r.decimals1 },
    tickLower: r.tick_lower,
    tickUpper: r.tick_upper,
    tickAtPost: r.tick_at_post,
    liquidityAtPost: r.liquidity_at_post,
    text: r.text,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

async function listCallouts(env, url) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 50);
  const before = parseInt(url.searchParams.get("before") || "", 10);
  const addr = url.searchParams.get("address");
  const where = [];
  const args = [];
  if (Number.isFinite(before)) {
    where.push("id < ?");
    args.push(before);
  }
  if (addr) {
    if (!isAddress(addr)) throw new HttpError(400, "bad_address", "That isn't a wallet address.");
    where.push("address = ?");
    args.push(getAddress(addr));
  }
  const sql = `SELECT * FROM callouts ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`;
  const { results } = await env.DB.prepare(sql)
    .bind(...args, limit)
    .all();
  return { items: results.map(format), next: results.length === limit ? results[results.length - 1].id : null };
}

async function postCallout(req, env, url) {
  const session = await requireSession(req, env);
  const body = await readJson(req);

  const tokenId = String(body.tokenId ?? "");
  if (!/^\d{1,30}$/.test(tokenId)) throw new HttpError(400, "bad_position", "Pick one of your positions to post.");
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) throw new HttpError(400, "empty_text", "Write a few words about your play.");
  if ([...text].length > MAX_TEXT) throw new HttpError(400, "too_long", `Keep it to ${MAX_TEXT} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new HttpError(400, "bad_text", "The text has characters that can't be posted.");
  if (LINKS.test(text)) {
    throw new HttpError(400, "links_blocked", "Links and wallet or contract addresses can't be posted. This keeps readers safe from phishing.");
  }

  const t = now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM callouts WHERE address = ? AND created_at > ?")
    .bind(session.address, t - 3600 * 1000)
    .first();
  if (recent.n >= HOURLY_LIMIT) throw new HttpError(429, "rate_limited", `You can post up to ${HOURLY_LIMIT} callouts an hour. Try again later.`);
  const dup = await env.DB.prepare("SELECT id FROM callouts WHERE token_id = ?").bind(tokenId).first();
  if (dup) throw new HttpError(409, "already_posted", "This position already has a callout.");

  // Check the position on-chain.
  const client = chainClient(env);
  const id = BigInt(tokenId);
  const [owner, info, liq] = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: PM, abi: pmAbi, functionName: "ownerOf", args: [id] },
      { address: PM, abi: pmAbi, functionName: "getPoolAndPositionInfo", args: [id] },
      { address: PM, abi: pmAbi, functionName: "getPositionLiquidity", args: [id] },
    ],
  });
  if (owner.status !== "success" || info.status !== "success") {
    throw new HttpError(404, "no_position", "That position doesn't exist on Robinhood Chain.");
  }
  const devBypass =
    env.DEV_ALLOW_ANY_OWNER === "true" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (!devBypass && getAddress(owner.result) !== session.address) {
    throw new HttpError(403, "not_owner", "Only the wallet that holds this position can post it.");
  }
  const [key, packed] = info.result;
  const liquidity = liq.status === "success" ? liq.result : 0n;
  if (!key.tickSpacing) throw new HttpError(404, "no_position", "That position doesn't exist on Robinhood Chain.");
  if (liquidity === 0n) throw new HttpError(400, "position_closed", "This position is closed. Only open positions can be posted.");

  const poolId = poolIdOf(key);
  const tokens = [key.currency0, key.currency1];
  const calls = [{ address: SV, abi: svAbi, functionName: "getSlot0", args: [poolId] }];
  for (const a of tokens) {
    if (a.toLowerCase() !== ZERO) {
      calls.push({ address: a, abi: erc20Abi, functionName: "symbol" }, { address: a, abi: erc20Abi, functionName: "decimals" });
    }
  }
  const r = await client.multicall({ allowFailure: true, contracts: calls });
  const tick = r[0].status === "success" ? Number(r[0].result[1]) : null;
  let i = 1;
  const meta = tokens.map((a) => {
    if (a.toLowerCase() === ZERO) return { symbol: "ETH", decimals: 18 };
    const sym = r[i++];
    const dec = r[i++];
    return {
      symbol: sym.status === "success" ? cleanSymbol(sym.result, a) : cleanSymbol("", a),
      decimals: dec.status === "success" ? Number(dec.result) : 18,
    };
  });

  const row = await env.DB.prepare(
    `INSERT INTO callouts (address, token_id, pool_id, currency0, currency1, symbol0, symbol1, decimals0, decimals1,
       fee, tick_spacing, hooks, tick_lower, tick_upper, tick_at_post, liquidity_at_post, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      session.address,
      tokenId,
      poolId,
      getAddress(key.currency0),
      getAddress(key.currency1),
      meta[0].symbol,
      meta[1].symbol,
      meta[0].decimals,
      meta[1].decimals,
      Number(key.fee),
      Number(key.tickSpacing),
      getAddress(key.hooks),
      int24(packed >> 8n),
      int24(packed >> 32n),
      tick,
      liquidity.toString(),
      text,
      t
    )
    .first();
  return format(row);
}

/* ---------- router ---------- */
export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const route = `${req.method} ${path}`;
      let out;
      if (route === "GET /" || route === "GET /health") out = { ok: true, service: "retra-api" };
      else if (route === "POST /auth/nonce") out = await createNonce(env);
      else if (route === "POST /auth/verify") out = await verifySignIn(req, env);
      else if (route === "POST /auth/logout") out = await logout(req, env);
      else if (route === "GET /me") out = { address: (await requireSession(req, env)).address };
      else if (route === "GET /callouts") out = await listCallouts(env, url);
      else if (route === "POST /callouts") out = await postCallout(req, env, url);
      else throw new HttpError(404, "not_found", "Not found.");
      return json(out, 200, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status, cors);
      console.error(e);
      return json({ error: "server_error", message: "Something went wrong on the server. Try again." }, 500, cors);
    }
  },
};
