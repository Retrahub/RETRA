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

## Struktur

```
index.html       halaman utama
styles.css       semua style (dark theme, responsif)
config.js        PENGATURAN: contract address, link tombol, bahasa awal
i18n.js          terjemahan Bahasa Indonesia (tombol EN / ID di navbar)
script.js        interaksi: jam sesi New York, grafik bins, kartu callout, terminal, verdict, ganti bahasa
serve.js         server statis kecil untuk preview lokal
assets/logo.svg  logo dan favicon
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

Semua nilai di `config.js` masih kosong: contract address `$RETRA` (tampil "TBA") dan semua link.
