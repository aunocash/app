# AUNO — Panduan menjalankan source website

Paket source tanggal 13 September 2026, termasuk warna terbaru dan logo AUNO yang diunggah.

## Isi dan status
- Landing page, dashboard payment links, checkout, docs, whitepaper, roadmap, split payment.
- React + TypeScript, Vinext, Cloudflare Workers, Cloudflare D1.
- SOL/USDC: developer preview di Solana Devnet, bukan Mainnet.
- Split: kalkulator alokasi dan animasi; settlement ke beberapa wallet BELUM aktif.
- Tidak menyertakan node_modules, hasil build, database transaksi, rahasia RPC, kredensial, atau riwayat Git.
- Ini source, bukan ZIP statis untuk diunggah ke public_html.

## Jalankan lokal
1. Ekstrak ZIP dan buka terminal di folder AUNO-Website.
2. Gunakan Node.js 24 dan npm.
3. Jalankan `npm ci`.
4. Salin `.env.example` menjadi `.dev.vars` di root proyek. Isi endpoint RPC Devnet milik Anda apabila endpoint publik ditolak/rate-limited. Jangan masukkan private key atau seed phrase.
5. Inisialisasi database lokal dengan:
   `npx wrangler d1 execute DB --local --config wrangler.local.json --file drizzle/0000_lush_the_executioner.sql`
6. Jalankan `npm run dev`, buka http://localhost:5173.
7. Cek `/api/health` untuk kondisi database dan RPC. Pastikan binding DB dan penyimpanan lokal konsisten jika menggunakan konfigurasi sendiri.
8. Gunakan wallet khusus Devnet untuk pengujian. Penandatanganan wallet dan pendanaan token tes dilakukan terpisah.

Perintah di atas disusun dari konfigurasi source. Instalasi bersih di komputer Anda belum diuji; build source berhasil pada lingkungan pembuatan.

## Build
`npm run build`
Output Worker: dist/server/index.js. Aset browser: dist/client.
`npm run start` menjalankan Wrangler lokal untuk hasil build; ini bukan server Node/Express generik.

## Menjalankan di hosting lain
Source ini bergantung pada runtime Cloudflare (`cloudflare:workers`) dan database D1 binding `DB`.
Untuk Cloudflare Workers milik sendiri: siapkan akun, Worker, database D1, konfigurasi Worker/aset, ID database asli, variabel SOLANA_NETWORK=devnet dan SOLANA_RPC_URL, lalu terapkan SQL migrasi sebelum melayani pembayaran. Gunakan hasil build dengan konfigurasi hosting Anda; jangan deploy placeholder database ID. Konfigurasi wrangler.local.json hanya untuk lokal, bukan konfigurasi produksi.

Untuk Vercel, VPS Node biasa, atau shared hosting: frontend dapat dipindahkan, tetapi akses database dan handler pembayaran yang memakai `cloudflare:workers` harus diadaptasi. ZIP ini belum merupakan port Vercel/PHP/Express. Login privat ChatGPT pada situs lama tidak ikut berpindah; atur autentikasi dan akses pada hosting tujuan sebelum membuka aplikasi ke publik.

`.openai/hosting.json` dalam ekspor tetap menyimpan binding logis DB yang dibaca vite.config.ts, namun project_id situs lama dihapus agar ekspor tidak terikat ke situs asal. Tidak ada perubahan ID pada situs asli.

## Pengujian sebelum penggunaan
`npm run typecheck`, `npm test`, dan `npm run build`.
Tes otomatis bukan bukti transaksi nyata. Lakukan tes wallet Devnet lengkap dan verifikasi signature/nominal/penerima sebelum mengklaim pembayaran berfungsi. Lihat README.md untuk protokol, keterbatasan, dan kebutuhan operasional.
