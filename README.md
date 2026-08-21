# LYNXIEE MARKET AI

> **Modern Full-Stack AI Chatbot Platform with OpenRouter Admin Control Panel (`/openr`), Multi-Provider Engine & REST API**

Platform AI Chatbot canggih dan modern yang dikembangkan untuk **LYNXIEE MARKET**. Dilengkapi dengan antarmuka futuristik (*Dark Mode, Glassmorphism, Neon Glow, 3D Particle Starfield*), dukungan streaming respons real-time, **Admin Panel (`/openr`)**, integrasi **OpenRouter API & Mayzaa AI**, serta **Endpoint REST API GET/POST** yang siap pakai.

---

## 📑 Daftar Isi
- [Fitur Utama](#-fitur-utama)
- [Struktur Halaman & Routing](#-struktur-halaman--routing)
- [Konfigurasi Environment (.env)](#-konfigurasi-environment-env)
- [API Endpoints](#-api-endpoints)
- [Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
- [Deployment Produksi (VPS & Docker / PM2 / Nginx)](#-deployment-produksi)
- [Keamanan & Proteksi](#-keamanan--proteksi)
- [Lisensi & Kredit](#-lisensi--kredit)

---

## 🌟 Fitur Utama

### 1. 🤖 Antarmuka Chatbot Modern (Public Interface)
- **Tema Futuristik & Responsif**: Palet Cyberpunk Neon Cyan, Deep Indigo, dan Glassmorphism yang nyaman di mata.
- **Background Partikel 3D**: Canvas partikel konstelasi interaktif yang bergerak halus mengikuti interaksi kursor.
- **Streaming Respons AI**: Output teks mengalir real-time menggunakan Server-Sent Events (SSE).
- **Multi-Percakapan (History Management)**: Pengelompokan riwayat obrolan (*Hari Ini, Kemarin, 7 Hari Terakhir, Terdahulu*), fitur Pin percakapan, Rename judul otomatis / manual, dan hapus obrolan.
- **Markdown & Code Highlighting**: Dukungan blok kode dengan syntax highlighting (Highlight.js), One-Click Copy Code, dan link sanitasi aman.
- **Fitur Tambahan**: Text-to-Speech (Suara AI), Regenerate Response, dan Quick Prompt Templates.

### 2. ⚡ Admin Control Panel (`/openr`)
- **Akses Rahasia**: Hanya dapat diakses langsung melalui URL `/openr` (misal: `https://domain.com/openr` atau `public/openr.html`).
- **Autentikasi Terproteksi**: Menggunakan password admin yang dikonfigurasi melalui environment variable `ADMIN_PASSWORD` di `.env` (Default: `LYNXIEE MARKET`).
- **OpenRouter Management**:
  - Simpan, update, dan uji coba OpenRouter API Key secara aman di backend.
  - Tambah, edit, toggle, atau hapus model OpenRouter kustom.
  - Model switcher langsung untuk mengatur model AI aktif.
- **Mayzaa AI Integration**: Konfigurasi endpoint REST API Mayzaa.
- **Kustomisasi Parameter AI**: Pengaturan Temperature, Max Output Tokens, Top-P, dan Custom System Prompt.
- **Sandbox Preview**: Simulator live chat internal untuk pengujian model sebelum dipakai pengguna.
- **Audit Logs & Telemetry**: Riwayat request, waktu latensi, model yang dipakai, dan status kode tanpa membocorkan API key pengguna.

### 3. 🌐 API Endpoints GET & POST Siap Pakai
- **Direct GET API**: Memungkinkan integrasi cepat dari aplikasi pihak ketiga, bot WhatsApp, bot Telegram, atau skrip eksternal hanya melalui URL query `?text=...`.

---

## 🧭 Struktur Halaman & Routing

| Rute URL | Tampilan / Handler | Keterangan |
| :--- | :--- | :--- |
| `/` | `index.html` (React SPA) | Halaman utama AI Chatbot publik untuk pengunjung |
| `/openr` | `public/openr.html` / Admin Panel | Halaman rahasia Admin Control Panel (Password Protected) |
| `/api/ai/chat-gpt` | Server API Endpoint | Direct GET/POST API ChatGPT |
| `/api/chat` | Server API Endpoint | Endpoint utama obrolan AI (Mendukung GET query & POST JSON streaming) |
| `/api/openrouter/*` | Server Admin API | Rute konfigurasi API key dan model OpenRouter |
| `/api/admin/*` | Server Admin API | Rute autentikasi admin, logs, dan statistik |

---

## ⚙️ Konfigurasi Environment (.env)

Buat file `.env` di direktori root aplikasi:

```env
# Port dev/server (Default: 3000)
PORT=3000

# Password untuk login ke panel /openr
ADMIN_PASSWORD=LYNXIEE MARKET

# OpenRouter API Key (Dapat diisi di sini atau melalui dashboard /openr)
OPENROUTER_API_KEY=

# Model default OpenRouter
OPENROUTER_MODEL=openai/gpt-4o-mini

# Endpoint ChatGPT Mayzaa AI
MAYZAA_API_URL=https://api.mayzaa.my.id/api/ai/chat-gpt?text=

# Secret key untuk cookie session admin
SESSION_SECRET=lynxiee_market_ai_super_secret_session_key_2026

# Gemini API Key (Opsional jika menggunakan Gemini fallback)
GEMINI_API_KEY=
```

---

## 📡 API Endpoints

### 1. Direct GET ChatGPT (`/api/ai/chat-gpt`)
Endpoint sederhana untuk mendapatkan respons AI via HTTP GET.

**Contoh Request Plain Text:**
```http
GET /api/ai/chat-gpt?text=Halo%20apa%20kabar HTTP/1.1
Host: localhost:3000
```
*Respons:*
```
Halo! Saya kabar baik. Ada yang bisa saya bantu hari ini?
```

**Contoh Request JSON:**
```http
GET /api/ai/chat-gpt?text=Jelaskan%20apa%20itu%20AI&json=true HTTP/1.1
Host: localhost:3000
```
*Respons JSON:*
```json
{
  "status": true,
  "result": "Kecerdasan Buatan (AI) adalah simulasi proses kecerdasan manusia oleh mesin...",
  "source": "https://api.mayzaa.my.id/api/ai/chat-gpt?text=",
  "timestamp": 1771190000000
}
```

---

### 2. General GET Chat API (`/api/chat`)
Endpoint kompatibel dengan parameter query:

```http
GET /api/chat?text=Tuliskan%20puisi%20singkat HTTP/1.1
Host: localhost:3000
```

---

### 3. Full POST Chat Streaming (`/api/chat`)
Endpoint yang digunakan oleh antarmuka web untuk streaming SSE dengan riwayat pesan lengkap.

**Request:**
```http
POST /api/chat HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Buatkan fungsi JavaScript untuk reverse string." }
  ],
  "stream": true
}
```

---

## 🚀 Panduan Instalasi & Menjalankan

### Kebutuhan Sistem:
- **Node.js**: Versi 18.x atau lebih baru
- **npm**: Versi 9.x atau lebih baru

### Langkah-langkah:

1. **Clone repositori**:
   ```bash
   git clone https://github.com/username/lynxiee-market-ai.git
   cd lynxiee-market-ai
   ```

2. **Install dependensi**:
   ```bash
   npm install
   ```

3. **Siapkan konfigurasi `.env`**:
   ```bash
   cp .env.example .env
   ```

4. **Jalankan development server**:
   ```bash
   npm run dev
   ```

5. **Akses aplikasi**:
   - Web Chatbot: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/openr`

---

## 🏭 Deployment Produksi

### 1. Build Aplikasi
```bash
npm run build
```
Perintah ini akan mengompilasi frontend React ke folder `dist/` dan mem-bundle backend server Express ke `dist/server.cjs`.

### 2. Jalankan dengan PM2
```bash
npm install -g pm2
pm2 start dist/server.cjs --name "lynxiee-market-ai"
pm2 save
pm2 startup
```

### 3. Konfigurasi Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Wajib untuk Server-Sent Events (SSE Streaming)
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### 4. Aktifkan HTTPS / SSL dengan Certbot
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## 🛡️ Keamanan & Proteksi

- **Server-Side Key Isolation**: Kunci API OpenRouter maupun Gemini hanya tersimpan dan diproses pada layer backend Express, tidak pernah dikirim ke browser klien.
- **Admin Brute-force Protection**: Rate limiting ketat untuk percobaan login admin panel.
- **Chat Rate Limiting**: Proteksi endpoint chat untuk mencegah serangan denial-of-service (DoS).
- **HTTP Security Headers**: Dilengkapi konfigurasi Helmet, CORS aman, dan cookie session bertanda `httpOnly` & `SameSite=Lax`.
- **Sanitized Output**: Pencegahan serangan XSS dengan DOMPurify pada perenderan konten Markdown.

---

## 📄 Lisensi & Informasi

Dibuat dengan dedikasi untuk ekosistem **LYNXIEE MARKET**.
Hak cipta dilindungi undang-undang.

