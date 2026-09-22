# NEXUS — Realtime Device Monitor

A real-time device/server monitoring dashboard built with **Astro + TypeScript + Bun + Tailwind CSS + Lucide Icons**.

> ⚠️ **Security**: This build includes an authentication layer and session cookies. On the first startup, if the `NEXUS_PASSWORD` environment variable is not set, a random password will be automatically generated, saved to `data/password.txt`, and printed to the console. Make sure to update the host configuration as needed, or bind `HOST=127.0.0.1` for single-user access.

## Key Features

- **Live SSE Streaming (Server-Sent Events)**: Device metrics update automatically every 1.5 seconds via `/api/stream`, with an automatic fallback to polling `/api/metrics` if SSE is unstable. Powered by a **server-side broker** so multiple connected clients trigger only 1 full system scan per interval (resource-efficient).
- **Authentication**: Dedicated `/login` page, HttpOnly session cookies, constant-time password comparison, rate-limited login attempts, and sidebar logout. Security headers applied to every response (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and CSP in production).
- **CPU Monitoring**: CPU load, timeline graph, clock frequency, core count, **CPU temperature (main & per-core heatmap)**, **per-core load**, and **1/5/15 minute load averages**.
- **RAM & Swap**: Total capacity, active usage, available RAM, and Swap usage.
- **Storage Volumes**: Partition detection, capacity, free space, filesystem type + **Disk I/O throughput** (aggregate read/write per second).
- **Networking**: Real-time throughput per interface, IP addresses, and operational status.
- **Battery Status**: Displayed in the overview tab if supported by the host system.
- **GPU Telemetry**: Name, VRAM, driver, utilization, memory, and temperature (refreshes every 15 seconds).
- **Top Processes**: Top 20 CPU-consuming processes, searchable and sortable by PID, user, CPU, or MEM.
- **History & Trends**: Telemetry samples are persisted to **SQLite (`bun:sqlite` at `data/telemetry.db`)** with a 7-day retention period (configurable via `NEXUS_HISTORY_DAYS`), viewable across 5m/1h/6h/24h/7d ranges in the RESOURCES tab.
- **Server-side Alert Engine**: Configurable thresholds for CPU/RAM/SWAP/DISK/TEMP (warning & critical). Alerts are pushed only on state transitions (OK → WARNING → CRITICAL) to avoid notification spam. Features in-app toast notifications, SSE `alert` events, and log stream entries. Supports **Webhooks** (`NEXUS_WEBHOOK_URL`) for Discord/Teams/ntfy, etc.
- **Hardware Identity** (Devices tab): Manufacturer, model, serial number, BIOS, motherboard, kernel, and architecture via `/api/system`.
- **System Logs**: Real-time system events (telemetry, alerts, sync) with log level filtering, search, auto-scroll, and copy functionality.
- **Mobile Responsive**: Includes pause/resume live updates and auto-pausing when the tab is hidden.

## Getting Started

Make sure `bun` is installed on your system.

### 1. Install Dependencies

```bash
bun install

```

### 2. Development Mode

```bash
bun run dev
# or using bun runtime directly:
bun run dev:bun

```

Open your browser at `http://localhost:4321` → redirects to `/login`.

### 3. Build & Production Run

```bash
bun run build
bun run start

```

To access from another device on the same local network (LAN):

```bash
HOST=0.0.0.0 PORT=4321 NEXUS_PASSWORD='change-me' bun run start

```

### 4. Testing & Typechecking

```bash
bun test          # unit tests (formatting, security, alert engine)
bun run typecheck # tsc --noEmit

```

## Configuration (Environment Variables)

| Variable | Default | Description |
| --- | --- | --- |
| `NEXUS_PASSWORD` | auto-gen | Dashboard password (min 8 chars). Auto: `data/password.txt` |
| `NEXUS_WEBHOOK_URL` | — | Webhook URL to POST alert JSON payloads |
| `NEXUS_REFRESH_MS` | `1500` | Telemetry collection interval (min 500ms) |
| `NEXUS_HISTORY_DAYS` | `7` | SQLite history retention period (in days) |
| `HOST` / `PORT` | `0.0.0.0` / `4321` | Production server bind address & port (server entry) |

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | public | Health check + telemetry broker status |
| GET | `/api/login` | public | Authentication status `{authenticated}` |
| POST | `/api/login` | public | Login (JSON/form), issues session cookie |
| POST | `/api/logout` | public | Logout (clears session) |
| GET | `/api/metrics` | session | Current metric snapshot (polling fallback) |
| GET | `/api/stream` | session | SSE stream: data + `alert` + `status` events |
| GET | `/api/history` | session | `?range=5m|1h|6h|24h|7d` → downsampled series |
| GET | `/api/alerts` | session | `?since=<ms>` fetches recent alerts |
| GET | `/api/system` | session | Static hardware, BIOS, and OS identity details |

## Architecture

```text
browser ──SSE──▶ /api/stream ──subscribe──▶ lib/telemetry (metrics broker)
browser ──▶ /api/metrics ◀─getMetricsForPoll─┘         │ 1× per interval
                                                       ▼ lib/system (systeminformation + timeout guards)
                              lib/history (bun:sqlite / in-memory fallback)
lib/alerts (state machine) ─▶ webhook + SSE event:alert + persistence

```

* **Broker**: Only 1 collector process runs when 1 or more clients are active. Multi-client SSE streams do not duplicate system scans.
* **Persistence**: `data/telemetry.db` (SQLite via `bun:sqlite`), with an in-memory ring buffer fallback when running in Node without Bun.
* **Auth**: In-memory session token per server process; `nexus_session` cookie configured with `HttpOnly` and `SameSite=Strict`.
* **Security Headers**: Applied via `src/middleware.ts` for all responses; strict Content Security Policy (CSP) enabled in production.

## Roadmap (Planned Features)

* Multi-device agent architecture (push agents configured via registration tokens) — currently, the dashboard only monitors the local host.
* Kubernetes/Docker container metrics and service status.
* Per-interface network history charts.
* Export metrics snapshot as JSON/CSV.
* LDAP/OAuth integration.

## Tech Stack

* [Astro](https://astro.build?utm_source=gemini) (server output, `@astrojs/node` standalone)
* [React](https://react.dev?utm_source=gemini) + TypeScript strict
* [Tailwind CSS v4](https://tailwindcss.com?utm_source=gemini) (`@theme` design tokens)
* [systeminformation](https://github.com/manuelcortela/systeminformation?utm_source=gemini)
* [Bun](https://bun.sh?utm_source=gemini) runtime (`bun:sqlite`, `bun test`)
