# IoT Device Builder Lab

Platform praktikum IoT berbasis Cloudflare Workers, D1, Workers AI, dan WebXR. Proyek ini terpisah dari `immersive-microcontroller-lab` yang sebelumnya dibuat, sehingga tidak menimpa aplikasi lama.

## Fitur

- Enam perangkat: Smart Irrigation, Smart Trash Bin, Flood Early Warning, Smart Parking, Smart Home Automation, dan Smart Fish Pond.
- Katalog komponen bersama: ESP32/Arduino, sensor, aktuator, dan display.
- Perakitan virtual, pemetaan pin, simulasi input sensor, dan respons aktuator berbasis aturan.
- Visualisasi perangkat 3D dengan OrbitControls; tombol AR/VR mencoba WebXR jika perangkat dan browser mendukung.
- Akun dosen dan mahasiswa berbasis NIM/password.
- Dosen membuat akun mahasiswa dan password awal; mahasiswa wajib mengganti password saat login pertama.
- Autosave proyek mahasiswa ke Cloudflare D1 setelah perubahan (debounce 850 ms).
- Pengumpulan proyek, dashboard dosen, penilaian, dan umpan balik.
- Tantangan praktikum yang dihasilkan oleh Cloudflare Workers AI (maksimal 5 permintaan per akun dalam 10 menit).

## Struktur repository

```text
IoT_Device_Builder_Lab/
├── migrations/0001_init.sql
├── public/index.html
├── public/styles.css
├── public/app.js
├── public/viewer.js
├── src/worker.js
├── package.json
└── wrangler.jsonc
```

## Deployment Cloudflare (Git integration)

### 1. Buat repository GitHub baru

Buat repository bernama `iot-device-builder-lab`. Unggah **isi folder proyek** ke root repository, bukan ZIP-nya. Jangan mengunggah file `.env`, password, token, atau kredensial apa pun.

### 2. Buat database D1 terlebih dahulu

Di Cloudflare Dashboard:

1. Buka **Storage & databases → D1 SQL Database**.
2. Klik **Create database**.
3. Nama database: `iot-device-builder-db`.
4. Setelah dibuat, salin **Database ID** dari halaman detail database.

Buka `wrangler.jsonc` di GitHub, cari:

```json
"database_id": "REPLACE_WITH_D1_DATABASE_ID"
```

Ganti placeholder dengan Database ID yang disalin dari Cloudflare, lalu **Commit changes**. Jangan deploy sebelum placeholder diganti.

### 3. Buat Worker dari GitHub

1. Cloudflare Dashboard → **Workers & Pages → Create application**.
2. Pilih **Connect to Git** dan hubungkan repository `iot-device-builder-lab`.
3. Pastikan nama Worker `iot-device-builder-lab`.
4. Lanjutkan deployment.
5. Setelah deployment berhasil, buka tab **Domains** dan pastikan URL Production `*.workers.dev` aktif. `wrangler.jsonc` juga mengatur `workers_dev: true`.

`wrangler.jsonc` sudah mendefinisikan binding `DB`, `AI`, dan `ASSETS`. Jika dashboard meminta binding tambahan, gunakan nama binding yang sama persis.

### 4. Buat tabel database

Buka D1 database `iot-device-builder-db` → **Console**. Jalankan seluruh isi file `migrations/0001_init.sql` satu kali. Setelah berhasil, tabel `users`, `sessions`, `login_attempts`, `projects`, dan `grades` akan tersedia.

### 5. Atur akun dosen pertama

Buka Worker `iot-device-builder-lab` → **Settings → Variables and Secrets**. Tambahkan:

| Nama | Jenis | Nilai |
|---|---|---|
| `ADMIN_NIM` | Text variable | NIM dosen (4–24 karakter) |
| `ADMIN_NAME` | Text variable | Nama dosen |
| `ADMIN_PASSWORD` | Secret | Password awal minimal 10 karakter |

Simpan perubahan. Buka `https://NAMA-WORKER.SUBDOMAIN-ANDA.workers.dev/api/health` sekali untuk memicu pembuatan akun dosen pertama. Worker membuat akun dosen jika NIM tersebut belum ada di database. Password di-hash menggunakan PBKDF2; password asli tidak disimpan.

Jika NIM dosen sudah ada dalam database, bootstrap tidak akan menimpa password yang telah tersimpan.

### 6. Uji konfigurasi

Buka `https://NAMA-WORKER.SUBDOMAIN-ANDA.workers.dev/api/health`. Hasil yang diharapkan:

```json
{
  "status": "ok",
  "databaseConfigured": true,
  "databaseReady": true,
  "teacherConfigured": true,
  "aiConfigured": true
}
```

Jika `databaseReady` false, periksa D1 binding/Database ID dan pastikan SQL inisialisasi sudah dijalankan. Jika `teacherConfigured` false, periksa `ADMIN_NIM` dan `ADMIN_PASSWORD`. Jika `aiConfigured` false, periksa binding Workers AI bernama `AI`.

### 7. Buat akun mahasiswa

1. Login menggunakan NIM dan password dosen yang disimpan di Cloudflare Secrets.
2. Buka **Kelola Mahasiswa**.
3. Isi nama, NIM, dan password awal (minimal 8 karakter).
4. Sampaikan kredensial awal secara pribadi kepada mahasiswa.
5. Saat login pertama, mahasiswa diwajibkan mengganti password.

Mahasiswa menggunakan URL Worker yang sama dan login dengan NIM/password masing-masing. Setiap mahasiswa hanya dapat melihat proyek miliknya sendiri. Dosen dapat melihat seluruh proyek.

## Autosave dan penilaian

- Autosave hanya aktif untuk akun mahasiswa yang sudah login dan proyek berstatus Draft.
- Setiap perubahan disimpan ke D1 setelah jeda sekitar 850 ms. Jika ada perubahan lain saat proses simpan berlangsung, aplikasi menjadwalkan penyimpanan lanjutan agar perubahan terakhir tidak terlewat.
- **Kumpulkan praktikum** mengubah status proyek menjadi Submitted dan mengunci edit mahasiswa.
- Dosen membuka **Penilaian Praktikum**, memeriksa konfigurasi, memberi nilai 0–100, dan menambahkan umpan balik.
- Proyek yang sudah dinilai berstatus Graded.
- Mode Demo tidak mengirim proyek ke D1; data demo hanya berada di browser lokal. Jangan gunakan Mode Demo untuk penilaian.
- Jika ingin pindah proyek sebelum indikator autosave menunjukkan tersimpan, gunakan tombol **Simpan sekarang** dan tunggu status tersimpan.

## GenAI dan batas paket gratis

Fitur AI menggunakan binding Cloudflare Workers AI (`AI`) dan model `@cf/google/gemma-4-26b-a4b-it`; tidak memerlukan OpenAI API key. Workers AI memiliki alokasi gratis harian pada Workers Free, tetapi kuota terbatas dan dapat habis. Setelah kuota harian habis, pembuatan tantangan AI dapat gagal sampai kuota direset. Periksa panel penggunaan Workers AI pada Cloudflare. D1 juga memiliki batas penggunaan gratis harian dan kapasitas penyimpanan.

## Catatan AR/VR

Mode 3D desktop dapat digunakan pada browser yang mendukung WebGL. AR/VR menggunakan WebXR dan hanya aktif pada perangkat/browser yang mendukung `immersive-ar` atau `immersive-vr` (umumnya perlu HTTPS). Tombol AR/VR akan menampilkan pesan jika perangkat tidak mendukung. Visualisasi ini merupakan model edukasi, bukan simulasi rangkaian listrik tingkat elektronika atau pembacaan sensor fisik.

## Keamanan dan privasi

- Password tidak disimpan sebagai teks biasa; Worker menggunakan PBKDF2 dengan salt acak.
- Session menggunakan cookie `HttpOnly`, `Secure`, dan `SameSite=Lax`.
- API menerapkan pembatasan percobaan login sederhana.
- NIM, nama, konfigurasi perangkat, progres, nilai, dan umpan balik disimpan di D1 untuk keperluan pembelajaran.
- Jangan membagikan password admin atau password awal mahasiswa secara publik.
- Gunakan akun demo untuk presentasi tanpa menyimpan penilaian.

## Uji lokal

Perlu Node.js dan Wrangler:

```bash
npm install
npx wrangler dev
```

Untuk binding D1/AI lokal, siapkan resource Cloudflare dan konfigurasi Wrangler yang sesuai. Deployment produksi memakai resource pada `wrangler.jsonc`.
