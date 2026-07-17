# Panduan Deploy — Sistem Poin Pelanggaran Sekolah

## Stack
- **Hosting**: Docker Compose di VPS/EC2 (app + Caddy)
- **Database**: PostgreSQL 16 (container service `db`)
- **Auth**: NextAuth.js
- **ORM**: Prisma
- **Runtime**: Node.js 24 LTS
- **CI/CD**: GitHub Actions → GHCR → deploy SSH

---

## LANGKAH 1 — Persiapan server

1. Siapkan VPS/EC2 dengan akses SSH
2. Domain mengarah ke IP server (contoh: `point-sekolah.rofimain.com`)
3. Cert Cloudflare Origin (atau sertifikat TLS lain) di folder `certs/` di server
4. Siapkan secrets GitHub: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `ENV_FILE_CONTENT`, `CLOUDFLARE_ORIGIN_CERT`, `CLOUDFLARE_ORIGIN_KEY`

---

## LANGKAH 2 — Setup Project Lokal (opsional)

```bash
cd point-sekolah
npm install
cp .env.example .env.local
```

Edit `.env.local` untuk development lokal (hostname Postgres bisa `localhost` jika DB di host, atau `db` jika lewat Compose).

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/point_sekolah"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/point_sekolah"
NEXTAUTH_SECRET="jalankan: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

NEXT_PUBLIC_SCHOOL_NAME="SMA ISLAM AL AZHAR 1 JAKARTA"
NEXT_PUBLIC_SCHOOL_SHORT="NS"
NEXT_PUBLIC_STUDENT_DOMAIN="siswa.namaschool.sch.id"
NEXT_PUBLIC_STAFF_DOMAIN="namaschool.sch.id"
```

Generate secret:
```bash
openssl rand -base64 32
```

---

## LANGKAH 3 — Schema & seed (lokal)

```bash
# Terapkan migration
npx prisma migrate deploy

# Atau untuk dev cepat:
# npm run db:push

# Isi data awal
npm run db:seed
```

Akun contoh dari seed:
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@sman1contoh.sch.id | Admin@1234 |
| Guru | s.rahayu@sman1contoh.sch.id | Guru@1234 |
| Siswa | 0051234567@siswa.sman1contoh.sch.id | Siswa@1234 |

---

## LANGKAH 4 — Test lokal

```bash
npm run dev
```

Buka http://localhost:3000

---

## LANGKAH 5 — Deploy self-hosted (Docker)

### A. Environment di server / secret `ENV_FILE_CONTENT`

Hostname DB **harus** `db` (nama service di `docker-compose.yml`):

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ganti_password_kuat
POSTGRES_DB=point_sekolah
DATABASE_URL=postgresql://postgres:ganti_password_kuat@db:5432/point_sekolah
DIRECT_URL=postgresql://postgres:ganti_password_kuat@db:5432/point_sekolah
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://point-sekolah.rofimain.com
# ... NEXT_PUBLIC_*, CRON_SECRET, TELEGRAM_*, dll.
```

### B. Push ke `main`

Push ke branch `main` memicu workflow `.github/workflows/deploy.yml`:
1. Lint, test, typecheck, validasi/migration test, build, dan audit dependency.
2. Build image SHA dan smoke test dengan PostgreSQL sementara.
3. Push image yang sudah lulus ke GHCR.
4. SSH ke server, jalankan migration eksplisit, deploy image SHA yang sama, lalu tunggu readiness.

Production tidak menjalankan seed demo otomatis. `npm run db:seed` hanya untuk development/smoke test.

Setelah migrate, deploy menjalankan `npm run db:sync-pasal-15` (upsert master jenis pelanggaran, rapikan urutan nomor, hapus demo/nonaktif yang tidak dipakai riwayat) — aman di DB yang sudah ada user/data.

### C. Caddy / domain

Edit `Caddyfile` agar host sesuai domain sekolah, pastikan origin cert ada di `certs/`.

---

## Cron quiet-month (remisi poin)

Hitung dari **tanggal kejadian** pelanggaran terakhir (`ViolationRecord.date`), bukan tanggal input (`createdAt`).

Endpoint API: `POST /api/cron/quiet-month-points` + header `x-cron-secret`.

Service Compose **`cron`** memanggil endpoint itu setiap hari pukul 02:00 (zona waktu mengikuti `TZ` di `.env`, contoh `Asia/Jakarta`).

Pastikan di `ENV_FILE_CONTENT` / `.env` server ada:

```env
CRON_SECRET=isi_random_panjang
POINT_REDUCTION_QUIET_DAYS=30
TZ=Asia/Jakarta
```

Setelah `docker compose up -d`, cek log: `docker compose logs -f cron`.

Alternatif host crontab (jika cron container dimatikan):

```cron
0 2 * * * curl -sS -X POST "https://point-sekolah.rofimain.com/api/cron/quiet-month-points" -H "x-cron-secret: $CRON_SECRET"
```

---

## KUSTOMISASI DOMAIN EMAIL SEKOLAH

Di `.env` produksi, ubah:
```
NEXT_PUBLIC_STUDENT_DOMAIN=siswa.sma-anda.sch.id
NEXT_PUBLIC_STAFF_DOMAIN=sma-anda.sch.id
```

Format email: `nisn@siswa.…` (siswa), `nama@…` (staf).

---

## RESET PASSWORD SISWA / GURU

Setiap pengguna dapat memilih **Password** pada top bar dan memasukkan password saat ini.
Admin tetap dapat mereset password akun yang dikelola melalui halaman Manajemen Pengguna.

---

## TROUBLESHOOTING

**Error: PrismaClientInitializationError**
→ Cek `DATABASE_URL` / `DIRECT_URL` (hostname `db` di dalam Compose)

**Error: NEXTAUTH_URL mismatch**
→ Pastikan `NEXTAUTH_URL` sama dengan URL publik HTTPS

**Login gagal "domain tidak valid"**
→ Cek `NEXT_PUBLIC_STUDENT_DOMAIN` dan `NEXT_PUBLIC_STAFF_DOMAIN`

**Build gagal di GitHub Actions (`npm ci` / Prisma)**
→ Pastikan Dockerfile memakai `npm ci --ignore-scripts` lalu `npx prisma generate` setelah `COPY . .`

**migrate deploy kosong / gagal**
→ Pastikan folder `prisma/migrations/` ada di image
