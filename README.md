# GoodevaDesk - Multi-Tenant AI Support Desk Backend

Backend service internal customer support dengan arsitektur **Multi-Tenant Data Isolation**, **Otomasi Klasifikasi & Draft Balasan AI (Google Gemini & Groq API)**, **Redis Caching**, **Prisma ORM + PostgreSQL**, dan **Docker Containerization**.

### 1. Menggunakan Docker 
```bash
# Salin konfigurasi environment
cp .env.example .env

# Jalankan semua container (PostgreSQL, Redis, NestJS API)
docker compose up -d

# Akses Swagger UI
open http://localhost:3000/docs
```

### 2. Tanpa Docker 
```bash
# 1. Install dependencies
npm install

# 2. Jalankan PostgreSQL dan Redis
docker compose up -d postgres redis

# 3. Sinkronkan database schema
npx prisma db push

# 4. Seed data awal (Acme Corp & Stark Industries)
npm run seed

# 5. Jalankan aplikasi
npm run start:dev
```

### Cara Menjalankan Benchmark GLiNER vs LLM:
```bash
# Jalankan benchmark suite tiket
python3 scripts/nlp_ticket_pipeline.py --out scripts/gliner_llm_comparison.json

# Uji analisis tiket tunggal via terminal
python3 scripts/nlp_ticket_pipeline.py \
  --email "user@fintech.id" \
  --subject "Gagal verifikasi pembayaran invoice INV-9912" \
  --message "Sistem kami mengembalikan error HTTP 500 saat checkout."
```

### Menjalankan Knowledge Base Crawler:
```bash
# Crawl & chunking dengan ekstraksi entitas GLiNER
python3 scripts/knowledge_crawler.py --out scripts/knowledge_base_sample.json
```

## Pilihan Provider LLM

GoodevaDesk memakai dua provider: **Groq** untuk klasifikasi tiket dan **Google Gemini** untuk draft balasan. Alasannya:

- **Kecepatan Groq.** Klasifikasi (kategori, prioritas, sentimen) menghasilkan output pendek dan terstruktur. Inferensi Groq berjalan dengan latensi rendah, sehingga tiket baru terklasifikasi dalam hitungan detik tanpa memblokir request pembuatan tiket.
- **Kualitas bahasa Gemini.** Draft balasan menuntut nada sopan dan konteks yang utuh. Gemini menangani Bahasa Indonesia dan campuran Indonesia-Inggris dengan baik, dan jendela konteksnya cukup besar untuk memuat riwayat tiket dan potongan knowledge base.
- **Output JSON terstruktur.** Kedua provider mendukung mode respons JSON, sehingga hasil klasifikasi langsung lolos validasi skema tanpa parsing teks bebas.
- **Fallback antar provider.** Jika satu provider timeout atau mengembalikan error, service memanggil provider lain. Gangguan di satu vendor tidak menghentikan alur tiket.
- **Biaya per tugas.** Model kecil dan murah cukup untuk klasifikasi. Model yang lebih mampu hanya dipakai pada draft balasan, tempat kualitas teks berpengaruh langsung ke pelanggan.

## Keputusan Desain

### Skema Data dan Isolasi Tenant

- Skema database mengikuti spesifikasi pada guide tanpa modifikasi, dan dikelola lewat Prisma (`prisma/schema.prisma`).
- Isolasi data antar tenant diterapkan di level aplikasi. Setiap query membawa identitas tenant yang berasal dari API key terautentikasi, bukan dari input klien.

### Strategi Caching Redis

Semua key Redis diawali `tenantId`, sehingga cache tidak pernah mencampur data antar tenant.

| Cache | Key | Invalidasi |
|-------|-----|------------|
| Hasil klasifikasi LLM | hash dari `subject + message` yang sudah dinormalisasi | TTL |
| Lookup API key | hash API key | TTL pendek, dihapus saat key dicabut |
| Daftar tiket | `tenantId` + parameter filter dan halaman | Dihapus saat ada tiket baru atau perubahan status |
| Detail tiket | `tenantId` + `ticketId` | Dihapus saat tiket diperbarui |

- **Cache klasifikasi.** Tiket dengan subject dan isi identik, atau yang menjadi identik setelah normalisasi (huruf kecil, spasi dirapikan), memakai hasil yang tersimpan. Panggilan LLM dan biayanya hilang untuk tiket duplikat.
- **Cache API key.** Autentikasi membaca key dari Redis sehingga tidak ada query database di setiap request. Waktu lookup turun ke level sub-milidetik.
- **Cache tiket.** Daftar dan detail tiket di-cache. Operasi create dan update status menghapus key terkait secara otomatis, jadi agen tidak melihat data kedaluwarsa.

## Rencana Perbaikan

Jika waktu pengerjaan lebih panjang, prioritasnya:

1. **Antrean job AI.** Pindahkan klasifikasi dan pembuatan draft ke BullMQ dengan retry dan backoff, supaya endpoint pembuatan tiket langsung merespons.
2. **Row-Level Security PostgreSQL.** Tambahkan lapisan isolasi di level database sebagai pelindung kedua di luar filter aplikasi.
3. **Semantic cache.** Simpan embedding tiket di pgvector agar tiket yang mirip, bukan hanya identik, bisa memakai hasil klasifikasi yang sama.
4. **Rate limiting per tenant.** Batasi request API dan pemakaian token LLM per tenant.
5. **Circuit breaker.** Hentikan sementara panggilan ke provider yang gagal berulang, lalu pindah ke provider cadangan.
6. **Tes otomatis.** Tambahkan e2e test yang membuktikan tenant A tidak bisa membaca atau mengubah data tenant B, plus unit test untuk invalidasi cache.
7. **Observabilitas.** Catat latensi, tingkat cache hit, dan biaya token per tenant di dashboard.
8. **Umpan balik agen.** Simpan koreksi agen pada kategori dan draft, lalu pakai data itu untuk mengevaluasi prompt dan memilih model.
9. **Rotasi API key.** Dukung masa berlaku key dan rotasi tanpa downtime.