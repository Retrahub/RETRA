// Robinhood Chain + Uniswap v4 settings used by the RETRA app.
// All values were checked on-chain on 2026-11-26 (eth_chainId, PositionManager.poolManager(), code at each address).

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  // Public RPC: free but rate-limited. Swap for a paid provider when traffic grows.
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  // Free keyless dRPC endpoint, used when the official RPC is busy.
  rpcFallback: "https://robinhood.drpc.org",
  explorer: "https://robinhoodchain.blockscout.com",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

export const CONTRACTS = {
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7", // Uniswap v4 PositionManager (LP positions are ERC-721)
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b", // Uniswap v4 StateView (current pool tick)
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951", // Uniswap v4 PoolManager
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
};

// Blockscout lists which position NFTs an address holds (the PositionManager is not enumerable on-chain).
export const BLOCKSCOUT_API = "https://robinhoodchain.blockscout.com/api/v2";

// RETRA API (Cloudflare Worker). Local dev uses `npm run dev` in api/.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_URL = LOCAL ? "http://127.0.0.1:8787" : "https://retra-api.retra-api.workers.dev";

export const MAX_POSITIONS = 100; // read at most two Blockscout pages per address
export const SESSION_HOURS = 24; // how long a wallet sign-in is remembered in this browser
