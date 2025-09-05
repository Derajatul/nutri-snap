# Nutri Snap

## Description

Nutri Snap adalah web app untuk memperkirakan kalori dan makro dari sebuah foto makanan. Unggah foto, biarkan AI mengenali item makanan, hitung nutrisi per porsi, sesuaikan porsi secara manual, dan bandingkan progres terhadap target personal harian.

## Technologies used

- Next.js 15 (App Router) & React 19
- TypeScript, Tailwind CSS v4
- UI primitives kustom (Card, Button, Donut, Skeleton, dsb.) dan lucide-react icons
- Replicate API (IBM Granite Vision 3.3 untuk deteksi; IBM Granite Instruct 3.3 untuk ringkasan/saran)
- Linter/formatter: Biome

## Features

- Upload foto makanan dengan preview
- Estimasi nutrisi total (kalori, protein, lemak, karbo) dengan visual Donut Chart
- Donut kalori dan makro memakai target personal sebagai batas (max)
- Ringkasan dan saran singkat di dalam kartu “Total Nutrition”
- Edit Manual per item: count, gram per unit (g/unit), dan total gram
- Kalkulator kebutuhan harian (profil disimpan di localStorage)
- Skeleton loading untuk pengalaman cepat dan halus

## Setup instructions

1. Prerequisites

   - Node.js 20+ dan npm

2. Instalasi

   ```bash
   npm install
   ```

3. Environment variables

   Buat file `.env.local` di root proyek:

   ```bash
   REPLICATE_API_TOKEN=your_replicate_api_token
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Catatan: REPLICATE_API_TOKEN diperlukan untuk memanggil model IBM Granite via Replicate.

4. Jalankan dalam mode pengembangan

   ```bash
   npm run dev
   ```

   Buka <http://localhost:3000>

5. Build untuk produksi (opsional)

   ```bash
   npm run build
   npm start
   ```

## AI support explanation

- Vision: IBM Granite Vision 3.3 (via Replicate) mengubah foto menjadi JSON item makanan (label, bbox, dsb.). Hasil dibersihkan dan dinormalisasi sebelum diproses.
- Nutrition: Tiap item diperkirakan per 100 g lalu diskalakan sesuai gram aktual/hasil penyesuaian. Total kalori/makro dijumlahkan lintas item.
- Summary & Advice: IBM Granite Instruct 3.3 (via Replicate) menghasilkan ringkasan dan saran singkat berdasarkan total nutrisi dan catatan.
- Target Personal: Kalkulator harian (Mifflin–St Jeor × faktor aktivitas) menyimpan profil di localStorage. Donut memakai target ini sebagai batas agar progres mencerminkan tujuan harian.
- Privasi: Gambar diunggah ke Replicate untuk inferensi model. Aplikasi ini bersifat informatif, bukan nasihat medis.
