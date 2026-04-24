# Panduan Deploy — Sistem Poin Pelanggaran Sekolah

## Stack
- **Hosting**: Vercel (gratis)
- **Database**: Neon PostgreSQL (gratis)
- **Auth**: NextAuth.js
- **ORM**: Prisma

---

## LANGKAH 1 — Setup Database di Neon (Gratis)

1. Buka https://neon.tech dan daftar (gratis, tidak perlu kartu kredit)
2. Klik **"New Project"**
3. Isi nama project (contoh: `school-violation`)
4. Pilih region terdekat (Singapore untuk Indonesia)
5. Klik **Create Project**
6. Di halaman project, klik **"Connection Details"**
7. Pilih **"Prisma"** di dropdown "Connection string"
8. Salin dua string koneksi:
   - `DATABASE_URL` (pooled connection)
   - `DIRECT_URL` (direct connection)

---

## LANGKAH 2 — Setup Project Lokal

```bash
# Clone / extract project
cd school-violation-system

# Install dependencies
npm install

# Salin file environment
cp .env.example .env.local
```

Edit file `.env.local` dengan nilai berikut:

```env
DATABASE_URL="postgresql://...?sslmode=require"   # dari Neon (pooled)
DIRECT_URL="postgresql://...?sslmode=require"      # dari Neon (direct)
NEXTAUTH_SECRET="jalankan: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

NEXT_PUBLIC_SCHOOL_NAME="Nama Sekolah Anda"
NEXT_PUBLIC_SCHOOL_SHORT="NS"
NEXT_PUBLIC_STUDENT_DOMAIN="siswa.namaschool.sch.id"
NEXT_PUBLIC_STAFF_DOMAIN="namaschool.sch.id"
```

Untuk generate NEXTAUTH_SECRET, jalankan di terminal:
```bash
openssl rand -base64 32
```

---

## LANGKAH 3 — Setup Database & Seed Data

```bash
# Push schema ke database
npm run db:push

# Isi data awal (kelas, jenis pelanggaran, akun demo)
npm run db:seed
```

Akun yang dibuat oleh seed:
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@sman1contoh.sch.id | Admin@1234 |
| Guru | s.rahayu@sman1contoh.sch.id | Guru@1234 |
| Siswa | 0051234567@siswa.sman1contoh.sch.id | Siswa@1234 |

---

## LANGKAH 4 — Test Lokal

```bash
npm run dev
```

Buka http://localhost:3000

---

## LANGKAH 5 — Deploy ke Vercel (Gratis)

### A. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### B. Connect ke Vercel

1. Buka https://vercel.com dan login dengan GitHub
2. Klik **"Add New Project"**
3. Import repository dari GitHub
4. Vercel otomatis mendeteksi Next.js
5. **JANGAN klik Deploy dulu** — isi Environment Variables terlebih dahulu

### C. Isi Environment Variables di Vercel

Di halaman setup, klik **"Environment Variables"** dan tambahkan:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | String pooled dari Neon |
| `DIRECT_URL` | String direct dari Neon |
| `NEXTAUTH_SECRET` | Random string 32 karakter |
| `NEXTAUTH_URL` | https://namaproject.vercel.app |
| `NEXT_PUBLIC_SCHOOL_NAME` | Nama sekolah |
| `NEXT_PUBLIC_SCHOOL_SHORT` | Singkatan (2 huruf) |
| `NEXT_PUBLIC_STUDENT_DOMAIN` | Domain email siswa |
| `NEXT_PUBLIC_STAFF_DOMAIN` | Domain email guru |
| `NEXT_PUBLIC_CRITICAL_POINTS` | 75 |
| `NEXT_PUBLIC_WARNING_POINTS` | 50 |

6. Klik **Deploy**

### D. Update NEXTAUTH_URL

Setelah deploy selesai, Vercel akan memberi URL seperti `https://school-violation-abc123.vercel.app`.
Pergi ke **Settings → Environment Variables** dan update `NEXTAUTH_URL` ke URL tersebut.
Klik **Redeploy**.

---

## LANGKAH 6 — Jalankan Seed di Production

Di terminal lokal, ubah DATABASE_URL ke Neon (sudah ada di .env.local) lalu:

```bash
npm run db:seed
```

Atau gunakan Neon SQL editor di dashboard Neon.

---

## KUSTOMISASI DOMAIN EMAIL SEKOLAH

Di file `.env.local` dan Vercel, ubah:
```
NEXT_PUBLIC_STUDENT_DOMAIN=siswa.sma-anda.sch.id
NEXT_PUBLIC_STAFF_DOMAIN=sma-anda.sch.id
```

Pastikan email siswa menggunakan format: `nisn@siswa.sma-anda.sch.id`
Pastikan email guru menggunakan format: `nama@sma-anda.sch.id`

---

## RESET PASSWORD SISWA / GURU

Jalankan script ini di terminal (ganti email dan password):

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
bcrypt.hash('PasswordBaru123', 12).then(h =>
  prisma.user.update({ where: { email: 'email@domain.sch.id' }, data: { password: h } })
).then(u => { console.log('Updated:', u.name); prisma.$disconnect(); });
"
```

---

## TROUBLESHOOTING

**Error: PrismaClientInitializationError**
→ Cek DATABASE_URL dan DIRECT_URL di environment variables

**Error: NEXTAUTH_URL mismatch**
→ Pastikan NEXTAUTH_URL sama persis dengan URL Vercel Anda

**Login gagal "domain tidak valid"**
→ Cek NEXT_PUBLIC_STUDENT_DOMAIN dan NEXT_PUBLIC_STAFF_DOMAIN

**Build gagal di Vercel**
→ Pastikan semua environment variables sudah diisi sebelum deploy

---

## LIMIT GRATIS

| Service | Limit Gratis |
|---------|-------------|
| Vercel | 100 GB bandwidth/bulan, unlimited deploy |
| Neon | 512 MB storage, 190 jam compute/bulan |

Untuk sekolah dengan ~1000 siswa, limit ini lebih dari cukup.
