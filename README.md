# NEXUS — Realtime Device Monitor

Dashboard pemantauan kondisi perangkat/server secara realtime berbasis **Astro + TypeScript + Bun + Tailwind CSS + Lucide Icons**.

> ⚠️ **Security**: build kode ini menambahkan lapisan autentikasi & session cookie. Ketika pertama kali start & env `NEXUS_PASSWORD` tidak set, password random auto-generate lalu disimpan di `data/password.txt` dan dicetara di console. Jadikan semua ganti `host` di README bawah, atau bind `HOST=127.0.0.1` untuk single-user.

## Fitur Utama

- **Live Streaming SSE (Server-Sent Events)**: Metrik perangkat diperbarui secara otomatis setiap 1.5 detik melalui `/api/stream`, dengan fallback otomatis ke polling `/api/metrics` jika SSE tidak stabiel. **Server-side broker** sehingga N client hanya mem–trigger 1× full scan per interval (score efficient).
- **Autentikasi**: login page `/login`, session cookie HttpOnly, password constant-time compare, rate-limit percobaan login, logout dari sidebar. Security headers di setiap response (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP di production).
- **CPU Monitoring**: beban CPU, timeline grafik, frekuensi clock, jumlah core, **suhu CPU (main & per-core heatmap)**, **per-core load**, dan **load average 1/5/15**.
- **RAM & Swap**: kapasitas total, pemakaian aktif, available RAM, penggunaan Swap.
- **Storage Volume**: deteksi partisi, kapasitas, free space, tipe filesystem + **Disk I/O throughput** (read/write per detik, aggregate).
- **Jaringan**: throughput real-time per interface, IP address, status operstate.
- **Battery Status** (disediakan di overview jika device didukung).
- **GPU Telemetry** (name, VRAM, driver, utilization, memory, temp — refresh 15 detik).
- **Top Processes**: top 20 dikonsumsi CPU, bisa disearch & disortir oleh PID/user/CPU/MEM.
- **History & Trends**: sampel dipersist ke **SQLite (`bun:sqlite` di `data/telemetry.db`)** dengan retention 7 hari (env `NEXUS_HISTORY_DAYS`), bisa baca rentang 5m/1h/6h/24h/7d di tab RESOURCES.
- **Alert Engine server-side**: threshold CPU/RAM/SWAP/DISK/TEMP (warn & crit). Alert hanya dipush saat state *cross esde* (ok→WARNING→CRITICAL) jadi tidak spammi. Notifikasi via toast in-app, event SSE `alert`, dan log stream. **Webhook** (`NEXUS_WEBHOOK_URL`) untuk Discord/Teams/ntfy etc.
- **Hardware Identity** (tab Devices): manufacturer, model, serial, BIOS, board, kernel, arch via `/api/system`.
- **System Logs**: event sistem real-time (telemetry, alert, sync) dengan filter level, search, auto-scroll, copy.
- **Mobil responsif** + pause/resume live update + auto-pause wane tab hidden.

## Cara Menjalankan

Pastikan `bun` sudah terpasang.

### 1. Install Dependencies

```bash
bun install
```

### 2. Mode Pengembangan (Development)

```bash
bun run dev
# atau menggunakan runtime bun langsung:
bun run dev:bun
```
Buka browser di `http://localhost:4321` → redirect ke `/login`.

### 3. Build & Run Production

```bash
bun run build
bun run start
```

Akses dari perangkat lain dalam satu jaringan lokal (LAN):

```bash
HOST=0.0.0.0 PORT=4321 NEXUS_PASSWORD='change-me' bun run start
```

### 4. Test & Typecheck

```bash
bun test          # unit test (format, security, alert engine)
bun run typecheck # tsc --noEmit
```

## Konfigurasi (Env Vars)

| Variable                 | Default    | Deskripsi                                              |
| ------------------------ | ---------- | ------------------------------------------------------- |
| `NEXUS_PASSWORD`         | auto-gen   | Password dashboard (min 8 char). Auto: `data/password.txt` |
| `NEXUS_WEBHOOK_URL`      | —          | URL webhook untuk POST alert JSON                       |
| `NEXUS_REFRESH_MS`       | `1500`     | Interval collection telemetry (min 500ms)               |
| `NEXUS_HISTORY_DAYS`     | `7`        | Retention history SQLite (dagen)                        |
| `HOST` / `PORT`          | `0.0.0.0` / `4321` | Bind production server (server entry)            |

## API Endpoints

| Method | Path           | Auth    | Deskripsi                                    |
| ------ | -------------- | ------- | -------------------------------------------- |
| GET    | `/api/health`  | public  | Liveness + telemetry broker status            |
| GET    | `/api/login`   | public  | Auth status `{authenticated}`                 |
| POST   | `/api/login`   | public  | Login (JSON/form), issue session cookie       |
| POST   | `/api/logout`  | public  | Logout (clear session)                        |
| GET    | `/api/metrics` | session | Snapshot metric current (polling fallback)     |
| GET    | `/api/stream`  | session | SSE: data + event:alert + event:status        |
| GET    | `/api/history` | session | `?range=5m\|1h\|6h\|24h\|7d` → downsampled series |
| GET    | `/api/alerts`  | session | `?since=<ms>` recent alerts                   |
| GET    | `/api/system`  | session | Static hardware/BIOS/OS identity              |

## Arsitektur

```text
browser ──SSE──▶ /api/stream ──subscribe──▶ lib/telemetry (metrics broker)
browser ──▶ /api/metrics ◀─getMetricsForPoll─┘        │ 1× per interval
                                                    ▼ lib/system (systeminformation + timeout guards)
                              lib/history (bun:sqlite / in-memory fallback)
lib/alerts (state machine) ─▶ webhook + SSE event:alert + persistence
```

- **Broker**: hanya 1 collector jalan ketika ≥1 client aktif. Multi-client SSE tidak duplikasi system scan.
- **Persistence**: `data/telemetry.db` (SQLite via `bun:sqlite`), fallback in-memory ring di Node tanpa Bun.
- **Auth**: session token in-memory per server process; cookie `nexus_session`, HttpOnly + SameSite=strict.
- **Security headers**: set di `src/middleware.ts` untuk semua response; CSP strict hanya di production.

## Roadmap (Belum Diimplementasi)

- Multi-device agent arsitektur (push-agent dikonfigurasi token registrasi) — sekarang dashboad hanya melihat host lokal.
- Kubernetes/Docker container metrics & service status.
- Grafik per-interface network history.
- Export snapshot JSON/CSV.
- LDAP/OAuth integration.

## Tech Stack

- [Astro](https://astro.build) (server output, `@astrojs/node` standalone)
- [React](https://react.dev) + TypeScript strict
- [Tailwind CSS v4](https://tailwindcss.com) (`@theme` design tokens)
- [systeminformation](https://github.com/manuelcortela/systeminformation)
- [Bun](https://bun.sh) runtime (`bun:sqlite`, `bun test`)
