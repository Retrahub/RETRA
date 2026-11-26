# RETRA

**Trade it. Tail it. Prove it.**

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
script.js        interaksi: jam sesi New York, grafik bins, kartu callout, terminal, verdict
serve.js         server statis kecil untuk preview lokal
assets/logo.svg  logo dan favicon
```

Tidak ada build step dan tidak ada dependency.

## Menjalankan di komputer

```bash
node serve.js
```

Lalu buka http://localhost:5173

## Yang masih placeholder

- Contract address `$RETRA` (sekarang "TBA")
- Link tombol **Launch app**, **Docs**, dan GitHub di footer
