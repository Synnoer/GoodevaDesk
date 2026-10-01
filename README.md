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

