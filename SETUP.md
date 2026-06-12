# 🚀 Flixify — Panduan Setup Produksi

Stack: **Firebase Auth + Firestore** · **Midtrans Snap** · **Vercel**

---

## DAFTAR ISI
1. [Firebase Setup](#1-firebase-setup)
2. [Midtrans Setup](#2-midtrans-setup)
3. [Konfigurasi .env](#3-konfigurasi-env)
4. [Deploy ke Vercel](#4-deploy-ke-vercel)
5. [Firestore Security Rules](#5-firestore-security-rules)
6. [Midtrans Webhook](#6-midtrans-webhook)
7. [Checklist Final](#7-checklist-final)

---

## 1. Firebase Setup

### A. Buat Project Firebase
1. Buka https://console.firebase.google.com
2. Klik **"Add project"** → masukkan nama (mis: `flixify-prod`)
3. Matikan Google Analytics (opsional) → **Create project**

### B. Aktifkan Authentication
1. Sidebar → **Build > Authentication** → **Get started**
2. Tab **Sign-in method** → klik **Email/Password** → Enable → **Save**

### C. Buat Firestore Database
1. Sidebar → **Build > Firestore Database** → **Create database**
2. Pilih **Production mode** → pilih region terdekat (mis: `asia-southeast1`) → **Enable**
3. Setelah database terbuat, paste Security Rules dari [Bagian 5](#5-firestore-security-rules)

### D. Ambil Config Client SDK
1. Sidebar → ⚙️ **Project Settings** → tab **General**
2. Scroll ke **"Your apps"** → klik ikon **Web (</>)**
3. Register app (nama: `flixify-web`) → **Register app**
4. Salin nilai dari `firebaseConfig`:
```js
const firebaseConfig = {
  apiKey: "...",           // → VITE_FIREBASE_API_KEY
  authDomain: "...",       // → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "...",        // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "...",    // → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "...",// → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "..."             // → VITE_FIREBASE_APP_ID
}
```

### E. Buat Service Account (untuk Webhook)
1. ⚙️ **Project Settings** → tab **Service accounts**
2. Klik **"Generate new private key"** → **Generate key**
3. File JSON akan terdownload. Ambil nilai:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
     ⚠️ Saat paste ke Vercel, pastikan newline (`\n`) tetap ada

---

## 2. Midtrans Setup

### A. Daftar Akun
1. Buka https://midtrans.com → **Daftar**
2. Verifikasi email

### B. Ambil API Keys (Sandbox dulu)
1. Login → klik nama bisnis di pojok kanan atas → **Settings**
2. Sidebar → **Access Keys**
3. Salin:
   - **Client Key Sandbox** → `VITE_MIDTRANS_CLIENT_KEY` (starts with `SB-Mid-client-`)
   - **Server Key Sandbox** → `MIDTRANS_SERVER_KEY` (starts with `SB-Mid-server-`)

### C. Set Notification URL (Webhook)
1. Midtrans Dashboard → **Settings > Configuration**
2. **Payment Notification URL**: `https://DOMAIN_KAMU.vercel.app/api/payment-webhook`
3. Klik **Update**

### D. Saat Siap Production
- Ganti ke **Production keys** (tanpa prefix `SB-`)
- Set `MIDTRANS_IS_PRODUCTION=true`
- Set `VITE_MIDTRANS_IS_PRODUCTION=true`
- Ikuti proses verifikasi bisnis Midtrans

---

## 3. Konfigurasi .env

### Development (.env.local)
```bash
# Salin dari .env.example dan isi nilai nyata
cp .env.example .env.local
```

Isi file `.env.local`:
```env
# Firebase Client
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=flixify-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=flixify-prod
VITE_FIREBASE_STORAGE_BUCKET=flixify-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Midtrans (Sandbox)
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
VITE_MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
MIDTRANS_IS_PRODUCTION=false

# App URL
VITE_APP_URL=http://localhost:5173

# Firebase Admin (untuk webhook)
FIREBASE_PROJECT_ID=flixify-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@flixify-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

---

## 4. Deploy ke Vercel

### A. Install Vercel CLI
```bash
npm i -g vercel
```

### B. Login & Deploy
```bash
vercel login
vercel --prod
```

Jawab pertanyaan setup:
- **Set up and deploy?** → Y
- **Which scope?** → pilih akun kamu
- **Link to existing project?** → N
- **Project name?** → `flixify`
- **Directory?** → `./` (root)
- **Override settings?** → N

### C. Set Environment Variables di Vercel
```bash
# Cara 1: Via CLI (satu per satu)
vercel env add VITE_FIREBASE_API_KEY production
vercel env add MIDTRANS_SERVER_KEY production
# ... dst

# Cara 2: Via Dashboard (lebih mudah)
# Buka https://vercel.com/[username]/flixify/settings/environment-variables
# Tambahkan semua variabel dari .env.example satu per satu
```

### D. Install firebase-admin di Vercel
Tambahkan di root `package.json` (sudah dilakukan):
```json
"optionalDependencies": {
  "firebase-admin": "^12.0.0"
}
```

### E. Redeploy setelah set env vars
```bash
vercel --prod
```

---

## 5. Firestore Security Rules

Paste rules ini di:
**Firebase Console > Firestore > Rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: bisa baca/tulis data sendiri
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Payments: hanya bisa dibaca oleh user yang bersangkutan
    match /payments/{docId} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow write: if false; // hanya webhook yang boleh tulis
    }
  }
}
```

---

## 6. Midtrans Webhook

Webhook berjalan di `/api/payment-webhook` (Vercel Serverless Function).

**Cara test di lokal:**
```bash
# Install ngrok
npm install -g ngrok

# Jalankan dev server
npm run dev

# Expose ke internet
ngrok http 5173

# Salin URL ngrok (mis: https://abc123.ngrok.io)
# Set di Midtrans: https://abc123.ngrok.io/api/payment-webhook
```

**Test pembayaran sandbox:**
- Kartu: `4811 1111 1111 1114` CVV: `123` Exp: `01/25`
- Atau gunakan VA BCA sandbox sesuai nominal transaksi

---

## 7. Checklist Final

### Sebelum Go-Live
- [ ] Semua env vars sudah diset di Vercel
- [ ] Firestore Security Rules sudah dipasang
- [ ] Webhook URL sudah diset di Midtrans
- [ ] Test register + login berhasil
- [ ] Test pembayaran sandbox berhasil
- [ ] User dapat nonton setelah premium aktif
- [ ] Test logout & session clear

### Switch ke Production
- [ ] Ganti ke Midtrans Production keys
- [ ] Set `MIDTRANS_IS_PRODUCTION=true` di Vercel
- [ ] Set `VITE_MIDTRANS_IS_PRODUCTION=true` di Vercel
- [ ] Update `VITE_APP_URL` ke domain final
- [ ] Update webhook URL Midtrans ke domain Vercel final
- [ ] Redeploy: `vercel --prod`

---

## Struktur File Baru

```
Flixify/
├── api/
│   ├── create-payment.js     ← Buat token Midtrans
│   └── payment-webhook.js    ← Terima notifikasi Midtrans
├── src/
│   └── lib/
│       ├── firebase.js        ← Firebase init
│       └── auth.js            ← Auth functions (Firebase)
├── vercel.json                ← Konfigurasi Vercel
├── .env.example               ← Template env vars
└── SETUP.md                   ← File ini
```
