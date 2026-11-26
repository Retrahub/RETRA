# RETRA

**Trade it. Tail it. Prove it.**

🌐 **Website:** https://retrahub.github.io/RETRA/

Website di-host gratis lewat GitHub Pages dari branch `main`. Setiap push ke `main` otomatis meng-update website dalam 1–2 menit.

Landing page RETRA: satu aplikasi on-chain di Robinhood Chain yang menggabungkan tiga modul:

| Modul | Isi |
|---|---|
| **Markets** | Pool saham tokenisasi (AAPL, NVDA, TSLA) dengan fee dan batas flow yang mengikuti jam bursa, plus opening auction |
| **Callouts** | Posisi LP dijadikan postingan yang bisa di-*tail* dalam satu klik, lengkap dengan badge anti-shill |
| **Proof** | Bounty USDG untuk menjalankan ulang riset di GPU teratestasi, dengan verdict per klaim |

## Aplikasi MVP (Callouts Lite)

🧪 **App:** https://retrahub.github.io/RETRA/app/

Minggu 1 (hanya baca, tidak pernah mengirim transaksi):

- **Masuk dengan wallet**: connect (MetaMask, Rabby, dll.), lalu satu tanda tangan pesan (EIP-191, format mirip Sign-In with Ethereum). Tanpa gas.
- **Pindah jaringan**: tombol untuk pindah ke atau menambahkan Robinhood Chain di wallet.
- **Posisi LP**: membaca posisi Uniswap v4 milik wallet (atau alamat apa pun lewat `?address=0x...`) langsung dari Robinhood Chain: pair, range harga, harga sekarang, status in-range, fee, hook.

Sumber data (semua gratis):

| Data | Sumber |
|---|---|
| Daftar NFT posisi milik alamat | Blockscout API `robinhoodchain.blockscout.com` |
| Isi posisi (pool, tick, liquidity) | Uniswap v4 PositionManager `0x58da…4fa7` lewat Multicall3 |
| Harga pool sekarang | Uniswap v4 StateView `0xf333…673b` |
| RPC | `rpc.mainnet.chain.robinhood.com` (publik, ada rate limit) |

Alamat kontrak dan pengaturan chain ada di `app/chain.js`.

## Struktur

```
index.html       halaman utama
styles.css       semua style (dark theme, responsif)
config.js        PENGATURAN: contract address, link tombol, bahasa awal
i18n.js          terjemahan Bahasa Indonesia (tombol EN / ID di navbar)
script.js        interaksi: jam sesi New York, grafik bins, kartu callout, terminal, verdict, ganti bahasa
serve.js         server statis kecil untuk preview lokal
assets/logo.svg  logo dan favicon
app/index.html   aplikasi MVP: login wallet + posisi LP
app/app.js       logika app (viem dari CDN, tanpa build step)
app/app.css      style khusus app
app/chain.js     Robinhood Chain + alamat kontrak Uniswap v4
```

Tidak ada build step dan tidak ada dependency.

## Mengisi contract address dan link

Buka `config.js`, isi nilainya, simpan, lalu refresh halaman:

```js
contractAddress: "0x...",            // muncul di chip CA dan section $RETRA, bisa di-copy
links: {
  app: "https://app.retra.xyz",      // tombol "Launch app"
  docs: "https://docs.retra.xyz",    // tombol "Docs"
  x: "https://x.com/retra",          // link X / Twitter di footer
  github: "",
  explorer: "",
},
```

Link yang dikosongkan tetap tampil dan mengarah ke bagian di halaman ini.

## Bahasa

Tombol **EN / ID** di navbar mengganti seluruh teks. Pilihan pengunjung diingat di browser mereka.
Teks baru di `index.html` perlu ditambahkan juga terjemahannya di `i18n.js` (bagian `text`).

## Menjalankan di komputer

```bash
node serve.js
```

Lalu buka http://localhost:5173

## Yang masih placeholder

Di `config.js`, contract address `$RETRA` (tampil "TBA") dan link Docs, X, GitHub, explorer masih kosong. Tombol **Launch app** sudah mengarah ke `app/`.
