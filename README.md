# Flixify

Aplikasi streaming film & serial berbasis React + Vite, siap deploy ke Vercel.

## Stack
- React 18 + Vite
- CSS Modules (tanpa Tailwind / external UI lib)
- TMDB API + Peachify embed

---

## Setup Lokal

### 1. Install dependencies
```bash
npm install
```

### 2. Buat file environment
```bash
cp .env.example .env.local
```
Edit `.env.local` dan isi API key TMDB:
```
VITE_TMDB_KEY=api_key_kamu_di_sini
```
> Dapatkan API key gratis di: https://www.themoviedb.org/settings/api

### 3. Jalankan dev server
```bash
npm run dev
```

---

## Deploy ke Vercel

### Cara 1 — Vercel Dashboard (rekomendasi)
1. Push repo ke GitHub
2. Buka [vercel.com](https://vercel.com) → **New Project** → import repo
3. Di bagian **Environment Variables**, tambahkan:
   - `VITE_TMDB_KEY` = api key kamu
4. Klik **Deploy**

### Cara 2 — Vercel CLI
```bash
npm i -g vercel
vercel --prod
# Saat ditanya environment variable, masukkan VITE_TMDB_KEY
```

> **⚠️ Jangan** commit file `.env.local` — sudah di-gitignore otomatis.

---

## Struktur Proyek

```
src/
├── components/        # UI reusable (Navbar, TabBar, Cards, dll)
├── hooks/             # Custom hooks (watchlist, progress, toast)
├── lib/               # Helpers (tmdb.js, storage.js)
├── pages/             # Halaman utama (Home, Watchlist, Profile)
├── styles/            # Global CSS + CSS variables
├── App.jsx            # Root component
└── main.jsx           # Entry point
```
