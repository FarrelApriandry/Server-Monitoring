# DESIGN.md

# NEXUS — Device Monitoring Dashboard

> Design specification for a futuristic, game-inspired device monitoring dashboard.

## 1. Project Overview

**NEXUS** is a real-time device monitoring dashboard designed to visualize system performance, hardware health, and resource utilization.

The interface takes inspiration from futuristic game HUDs, sci-fi command centers, and military-grade telemetry systems.

The design should feel like operating a sophisticated system control panel rather than using a conventional administration dashboard.

### Core Design Philosophy

* **Game-Tech Aesthetic:** Inspired by sci-fi interfaces, tactical HUDs, and in-game system terminals.
* **Functional First:** Visual elements must support data comprehension, not distract from it.
* **Information Density:** Display meaningful telemetry without overwhelming the user.
* **Real-Time Awareness:** Make system changes visually apparent.
* **Professional Execution:** Avoid excessive decoration, gimmicky animations, or impractical layouts.

### Design Keywords

`Futuristic` · `Tactical HUD` · `System Telemetry` · `Dark Interface` · `Cybernetic` · `Precision` · `Real-Time` · `Command Center`

---

# 2. Visual Direction

## 2.1 Overall Atmosphere

Imagine a system monitoring interface from a futuristic spacecraft or a tactical operations center.

The interface should communicate:

> "This system is being monitored, and every component is under control."

The visual language should combine:

* Futuristic game interfaces.
* Sci-fi computer terminals.
* Industrial control systems.
* Tactical data visualization.
* Modern developer tools.

### Avoid

* Generic SaaS dashboards.
* Excessive neon effects.
* Overly colorful cyberpunk aesthetics.
* Excessive gradients.
* Decorative elements that look like they belong in a game but have no functional purpose.
* Excessive glassmorphism.
* Large rounded cards with no information hierarchy.

**The design should look like a real monitoring system with a game-inspired visual identity.**

---

# 3. Color System

## 3.1 Base Theme

The dashboard uses a dark interface optimized for long monitoring sessions.

| Token                | Color     | Purpose                     |
| -------------------- | --------- | --------------------------- |
| `--bg-primary`       | `#080B10` | Main application background |
| `--bg-secondary`     | `#0D1219` | Secondary surfaces          |
| `--bg-panel`         | `#111821` | Dashboard panels            |
| `--bg-elevated`      | `#18212B` | Elevated components         |
| `--border-default`   | `#263440` | Standard borders            |
| `--border-active`    | `#3C5666` | Active borders              |
| `--text-primary`     | `#E6EDF3` | Main text                   |
| `--text-secondary`   | `#8A9BAA` | Supporting text             |
| `--text-muted`       | `#536574` | Metadata and labels         |
| `--accent-primary`   | `#65E6C1` | Main system accent          |
| `--accent-secondary` | `#66B7FF` | Secondary information       |
| `--status-warning`   | `#F4C95D` | Warning state               |
| `--status-danger`    | `#FF667A` | Critical state              |
| `--status-success`   | `#65E6C1` | Healthy state               |

### Color Rules

1. Use **cyan-green as the primary system accent**.
2. Blue represents information or secondary telemetry.
3. Yellow indicates a warning.
4. Red indicates a critical condition.
5. Do not use colors purely for decoration.
6. Status colors must maintain sufficient contrast.
7. Avoid using neon colors for large backgrounds.

> Accent colors should feel like illuminated indicators on industrial hardware—not like glowing gaming RGB.

---

# 4. Typography

## 4.1 Font Selection

Use a combination of modern UI typography and technical monospace typography.

### Primary Font

```css
font-family: "Inter", sans-serif;
```

Use for:

* Navigation.
* Headings.
* Descriptions.
* Labels.
* General interface content.

### Technical Font

```css
font-family: "JetBrains Mono", monospace;
```

Use for:

* CPU utilization.
* RAM statistics.
* Temperature values.
* Network throughput.
* Process IDs.
* Device identifiers.
* Timestamps.
* System logs.

### Typography Principles

* Prioritize readability over stylistic complexity.
* Use uppercase text selectively for technical labels.
* Avoid excessive letter spacing.
* Use tabular numerals for changing metrics.
* Use clear visual hierarchy between values and labels.

### Example

```text
CPU UTILIZATION

42.8 %
NORMAL
```

The numerical value should be visually dominant.

---

# 5. Layout Architecture

## 5.1 Application Structure

The application should use a persistent command-center layout.

```text
┌───────────────────────────────────────────────────────────────────┐
│ NEXUS / SYSTEM MONITOR                 ● ONLINE    18:42:09       │
├───────────────┬───────────────────────────────────────────────────┤
│               │                                                   │
│  NAVIGATION   │                MAIN WORKSPACE                     │
│               │                                                   │
│  OVERVIEW     │  PAGE HEADER                                      │
│  DEVICES      │  ───────────────────────────────────────────────  │
│  RESOURCES    │                                                   │
│  PROCESSES    │  SYSTEM STATUS                                    │
│  NETWORK      │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  STORAGE      │  │ CPU      │ │ MEMORY   │ │ TEMP     │            │
│  LOGS         │  │ 42.8%    │ │ 68.2%    │ │ 54°C     │            │
│               │  └──────────┘ └──────────┘ └──────────┘            │
│               │                                                   │
│               │  RESOURCE TELEMETRY                               │
│               │  ┌─────────────────────────────────────────────┐  │
│               │  │                                             │  │
│               │  │               LIVE CHART                    │  │
│               │  │                                             │  │
│               │  └─────────────────────────────────────────────┘  │
│               │                                                   │
│               │  DEVICE STATUS / ACTIVITY                        │
│               │                                                   │
└───────────────┴───────────────────────────────────────────────────┘
```

## 5.2 Sidebar

### Characteristics

* Fixed-width sidebar.
* Width: `224px–256px`.
* Darker than the main workspace.
* Subtle right border.
* Minimal visual noise.
* Compact navigation items.

### Navigation Items

```text
NEXUS
SYSTEM MONITOR

[ OVERVIEW ]

MONITORING
  DEVICES
  RESOURCES
  PROCESSES
  NETWORK
  STORAGE

SYSTEM
  EVENTS
  LOGS
  SETTINGS
```

### Active Navigation State

The active navigation item should feature:

* A subtle accent-colored left indicator.
* Slightly brighter background.
* Accent-colored icon.
* Clear text contrast.

Avoid excessive glow or animated backgrounds.

---

# 6. Main Dashboard — Overview

The Overview page is the primary monitoring screen.

It should answer these questions immediately:

1. Is the system healthy?
2. What resources are being consumed?
3. Is anything approaching a critical threshold?
4. Which devices are connected?
5. What has changed recently?

---

## 6.1 Header

### Content

```text
SYSTEM OVERVIEW
Real-time performance telemetry and device health

[ LIVE ● ] [ 1 DEVICE ] [ LAST SYNC: 2s AGO ]
```

### Header Behavior

* Show the current monitoring state.
* Display the number of monitored devices.
* Display the last successful data synchronization.
* Include a refresh or connection control.
* Avoid oversized page titles.

---

# 7. Core Metric Panels

## 7.1 Metric Card Design

Metric cards should feel like **instrument panels**, not ordinary SaaS cards.

### Example

```text
┌───────────────────────────────────────────────┐
│ CPU UTILIZATION                      ◉ CPU    │
│                                               │
│ 42.8 %                          NORMAL        │
│                                               │
│ ━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░             │
│                                               │
│ 8 CORES     3.42 GHz     LOAD: LOW            │
│                                               │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄             │
│ ▲ +2.4% FROM PREVIOUS SAMPLE                 │
└───────────────────────────────────────────────┘
```

### Required Metrics

#### CPU

* Overall utilization.
* Core count.
* Current frequency.
* Load average.
* Optional per-core utilization.

#### RAM

* Memory utilization percentage.
* Used memory.
* Available memory.
* Total memory.
* Swap usage.

#### Storage

* Disk usage.
* Available capacity.
* Read/write throughput.
* Disk health, when available.

#### Temperature

* CPU temperature.
* GPU temperature, when available.
* System temperature.
* Temperature status.

#### Network

* Download speed.
* Upload speed.
* Active interface.
* Latency, if available.

### Metric Card Rules

* Make the primary value prominent.
* Include a unit.
* Show the current state.
* Provide contextual metadata.
* Include a small historical trend when useful.
* Do not overload cards with unnecessary statistics.

---

# 8. Telemetry Visualization

## 8.1 Charts

Charts should resemble **technical telemetry displays**.

### Visual Characteristics

* Thin lines.
* Subtle grid lines.
* Clear axes.
* Minimal chart decoration.
* Smooth but restrained animations.
* Clear time ranges.
* No unnecessary 3D effects.

### Recommended Charts

| Chart               | Purpose                             |
| ------------------- | ----------------------------------- |
| CPU Usage Over Time | Identify processor load patterns    |
| RAM Usage Over Time | Monitor memory consumption          |
| Network Throughput  | Track incoming and outgoing traffic |
| Disk I/O            | Analyze storage activity            |
| Temperature History | Detect overheating trends           |
| System Load         | Observe overall resource pressure   |

### Example

```text
CPU TELEMETRY / LAST 60 SECONDS

100% ┤
     │                 ╭─╮
  75%┤       ╭──╮     ╭╯ ╰╮
     │  ╭────╯  ╰─────╯   ╰──╮
  50%┤──╯                    ╰──
     │
  25%┤
     │
   0%┼────────────────────────────────
       -60s       -30s         NOW
```

### Interaction

Users should be able to:

* Change the time range.
* Hover over data points.
* Toggle individual metrics.
* Pause live updates.
* Inspect exact values.
* Identify abnormal spikes.

---

# 9. Device Management

## 9.1 Device List

The dashboard should support monitoring multiple devices.

### Device Card

```text
┌──────────────────────────────────────────────────────────┐
│ ● ONLINE     WORKSTATION-01                         ›    │
│                                                          │
│ Ubuntu 24.04 · x86_64                                    │
│                                                          │
│ CPU       42%       RAM       68%       TEMP       54°C   │
│                                                          │
│ LAST SEEN: 2 SECONDS AGO                                 │
└──────────────────────────────────────────────────────────┘
```

### Device Information

* Device name.
* Operating system.
* Architecture.
* IP address, where appropriate.
* Connection status.
* Last seen.
* CPU usage.
* Memory usage.
* Temperature.
* Uptime.

### Status Indicators

```text
● ONLINE
◐ CONNECTING
● DEGRADED
× OFFLINE
```

Each state must be visually distinct and accessible without relying solely on color.

---

# 10. Processes & Resource Analysis

## 10.1 Process Table

The process view should feel like a **high-tech system diagnostic console**.

### Table Structure

| PID  | PROCESS  |   CPU | MEMORY | STATUS  | ACTION  |
| ---- | -------- | ----: | -----: | ------- | ------- |
| 1024 | node     | 12.4% | 324 MB | Running | Details |
| 2048 | postgres |  8.1% | 512 MB | Running | Details |
| 3091 | docker   |  4.2% | 180 MB | Running | Details |

### Design Guidelines

* Use monospace fonts for technical data.
* Right-align numerical values.
* Support sorting.
* Support filtering.
* Highlight unusually high resource usage.
* Use sticky table headers.
* Avoid excessive borders.

### Optional Features

* Process details.
* CPU and memory history.
* Process search.
* Resource consumption ranking.
* Safe process termination, if implemented.

> Any destructive action must require confirmation.

---

# 11. System Logs & Events

## 11.1 Log Viewer

The log interface should resemble a modernized terminal.

### Example

```text
SYSTEM EVENTS / LIVE STREAM

18:42:09  INFO     metrics     Telemetry updated successfully
18:42:07  INFO     network     Interface eth0 connected
18:42:05  WARNING  memory      Memory usage exceeded 75%
18:41:58  INFO     storage     Disk health check completed
18:41:52  INFO     system      Monitoring service started
```

### Log Features

* Severity filters.
* Search.
* Timestamp display.
* Auto-scroll toggle.
* Pause stream.
* Copy log entry.
* Expand structured metadata.
* Clear visual distinction between severity levels.

### Log Styling

Use a dark terminal-inspired panel with:

* Monospace typography.
* Subtle row separation.
* Minimal syntax coloring.
* No excessive scanline effects.
* No fake terminal animations.

---

# 12. Game-Tech Visual Elements

These elements establish the desired identity.

## 12.1 HUD-Inspired Components

Use selectively:

* Technical corner brackets.
* Small section identifiers.
* System status indicators.
* Coordinate-like metadata.
* Thin divider lines.
* Micro-labels.
* Compact telemetry badges.
* Small status glyphs.
* Technical data readouts.

### Example

```text
[ SYS.MONITOR / 01 ]
[ TELEMETRY STREAM ACTIVE ]
[ NODE: LOCALHOST ]
```

These elements should support the information hierarchy.

They should not turn every panel into a decorative science-fiction prop.

---

## 12.2 Panel Treatment

Panels should use:

* Sharp or mildly rounded corners.
* Thin borders.
* Subtle contrast against the background.
* Consistent spacing.
* Clear section headers.

### Recommended Border Radius

```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
```

Avoid excessive use of rounded containers.

### Optional HUD Corners

Use clipped or angled corners sparingly for:

* Main system status.
* Important alerts.
* Device connection panels.

Do not apply them to every component.

---

# 13. Motion & Interaction

## 13.1 Animation Philosophy

Animations should communicate system activity.

They should never interfere with monitoring.

### Appropriate Animations

* Smooth chart updates.
* Subtle connection status transitions.
* Progress bar changes.
* Panel appearance transitions.
* Soft highlight when a critical metric changes.
* Loading indicators.

### Avoid

* Constantly pulsing cards.
* Excessive screen shake.
* Flashing warnings.
* Aggressive neon glows.
* Decorative particle systems.
* Long transition delays.

### Animation Timing

```css
--duration-fast: 120ms;
--duration-normal: 200ms;
--duration-slow: 350ms;
```

Support:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable non-essential animations */
}
```

---

# 14. Responsive Design

The dashboard must work across desktop and smaller screens.

## Desktop

* Persistent sidebar.
* Multi-column metric grid.
* Large telemetry charts.
* Expanded tables.

## Tablet

* Collapsible sidebar.
* Two-column metric layout.
* Responsive charts.
* Condensed tables.

## Mobile

* Bottom navigation or drawer navigation.
* Single-column metrics.
* Horizontally scrollable tables.
* Prioritize system health and critical metrics.
* Avoid displaying every metric simultaneously.

### Important

Do not simply shrink the desktop interface.

Reorganize content based on importance.

---

# 15. Accessibility

Even though the design is futuristic, usability remains essential.

### Requirements

* Maintain adequate color contrast.
* Never communicate status through color alone.
* Provide accessible labels for icons.
* Support keyboard navigation.
* Ensure focus states are visible.
* Respect reduced-motion preferences.
* Use semantic HTML.
* Make interactive elements large enough to operate comfortably.
* Provide accessible chart summaries where appropriate.

---

# 16. Technical UI Components

Recommended reusable components:

```text
/components
├── layout/
│   ├── Sidebar
│   ├── Topbar
│   └── PageContainer
│
├── monitoring/
│   ├── MetricPanel
│   ├── ResourceGauge
│   ├── TelemetryChart
│   ├── DeviceStatus
│   ├── SystemHealth
│   └── StatusIndicator
│
├── devices/
│   ├── DeviceCard
│   ├── DeviceTable
│   └── DeviceDetails
│
├── processes/
│   ├── ProcessTable
│   └── ProcessDetails
│
├── logs/
│   ├── LogViewer
│   └── LogEntry
│
└── ui/
    ├── Button
    ├── Badge
    ├── Panel
    ├── Tooltip
    └── Modal
```

### Component Principles

* Components should be reusable.
* Avoid duplicating metric card implementations.
* Keep data fetching separate from presentation.
* Use consistent spacing and typography.
* Ensure loading, error, and empty states are designed.

---

# 17. Data States

Every monitoring component must account for the following states.

## Loading

```text
INITIALIZING TELEMETRY...
CONNECTING TO NODE...
```

## Healthy

```text
● SYSTEM NOMINAL
```

## Warning

```text
▲ RESOURCE USAGE ELEVATED
```

## Critical

```text
! CRITICAL SYSTEM CONDITION
```

## Offline

```text
× NODE CONNECTION LOST
```

## No Data

```text
NO TELEMETRY AVAILABLE
WAITING FOR DATA STREAM...
```

The interface must not display fake live metrics when data is unavailable.

---

# 18. Dashboard UX Priorities

The order of importance should be:

### Priority 1 — System Health

Can the user immediately determine whether the device is operating normally?

### Priority 2 — Resource Utilization

Can the user identify CPU, RAM, storage, and temperature problems?

### Priority 3 — Historical Context

Can the user understand whether a metric is increasing, decreasing, or stable?

### Priority 4 — Diagnosis

Can the user investigate processes, events, and logs?

### Priority 5 — Device Management

Can the user switch between and manage monitored devices?

---

# 19. Design Anti-Patterns

The following design decisions are prohibited unless there is a strong functional reason.

### ❌ Excessive Neon

Not every element needs a glow effect.

### ❌ Decorative Complexity

Do not sacrifice usability for the appearance of complexity.

### ❌ Fake Technical Elements

Avoid meaningless numbers, fake coordinates, and decorative system logs.

### ❌ Oversized Cards

Do not waste screen space on cards containing only one small value.

### ❌ Unnecessary Gradients

Prefer solid surfaces and subtle contrast.

### ❌ Excessive Glassmorphism

Avoid making every panel translucent.

### ❌ Unclear Status

Users must understand the system condition within seconds.

### ❌ Fake Real-Time Data

Never imply that data is live if it is simulated or unavailable.

---

# 20. Design Personality

NEXUS should feel like:

> A sophisticated system monitoring console built by an engineer who appreciates futuristic game interfaces.

It should not feel like:

> A generic dashboard with random sci-fi decorations added on top.

### Final Design Statement

**NEXUS combines the precision of professional monitoring tools with the visual language of futuristic game technology.**

Every panel, metric, indicator, and interaction should contribute to the feeling of operating a powerful, responsive, and reliable system.

The interface should be visually distinctive—but its primary purpose remains clear:

> **Understand the system. Detect anomalies. Act with confidence.**

---

## 21. Implementation Direction

When implementing the interface:

1. Start with the overall layout and information hierarchy.
2. Build the metric panels and system health overview.
3. Implement telemetry charts.
4. Add device monitoring.
5. Add process and log views.
6. Add responsive behavior.
7. Refine HUD-inspired visual details.
8. Optimize performance and accessibility.

**Do not begin with decorative effects. Build a functional monitoring interface first, then establish the game-tech identity through typography, spacing, borders, colors, and restrained motion.**
