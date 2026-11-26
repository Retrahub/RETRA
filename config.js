/*
 * RETRA — site settings
 * Isi nilai di bawah ini, simpan, lalu refresh halaman.
 * Kosongkan ("") kalau belum ada: tombolnya tetap tampil dan mengarah ke bagian halaman ini.
 */
window.RETRA_CONFIG = {
  // Contract address token $RETRA di Robinhood Chain, contoh: "0x1234...abcd"
  contractAddress: "",

  links: {
    app: "app/",  // tombol "Launch app" (aplikasi MVP di folder app/)
    docs: "",     // tombol "Docs" / "Read the docs"
    x: "",        // akun X / Twitter, contoh: "https://x.com/retra"
    github: "",   // repo publik (repo Retrahub/RETRA masih private)
    explorer: "", // halaman kontrak di block explorer
  },

  // Bahasa awal kalau pengunjung belum pernah memilih: "auto" (ikut bahasa browser), "en", atau "id"
  defaultLanguage: "auto",
};
