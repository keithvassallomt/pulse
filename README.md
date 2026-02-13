# Pulse — Lightweight Infrastructure Monitor

Pulse is a self-hosted infrastructure monitoring tool that connects to your machines via SSH, collects system metrics, monitors Docker containers, detects anomalies, forecasts capacity, and provides auto-healing capabilities — all through a clean web UI.

## System Requirements

- **Node.js** 18+ (tested on v20/v22)
- **SSH access** to target machines (key-based authentication)
- Target machines must run **Linux** with standard coreutils (`top`, `free`, `df`, `uptime`)
- **Docker** (optional) on target machines for container monitoring
- A modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone & Install Backend

```bash
git clone <your-repo-url> pulse
cd pulse
npm install
```

### 2. Install Frontend

```bash
cd frontend
npm install
npm run build   # produces frontend/dist/
cd ..
```

### 3. Start the Server

```bash
npm start
# or: node index.js
```

By default the server listens on **port 3000**. Override with the `PORT` environment variable.

## Access

- **Frontend (Vite dev server):** http://192.168.96.6:5173
- **Backend (Express API / static build):** http://192.168.96.6:3000

Open the URL above in your browser (use the backend URL if you're serving the built frontend from `frontend/dist`).

## Configuration

### SSH Keys

Pulse authenticates to remote machines using SSH **private key** authentication. By default it reads:

```
~/.ssh/id_rsa
```

To use a different key, set the `SSH_KEY_PATH` environment variable:

```bash
export SSH_KEY_PATH=/path/to/your/private_key
npm start
```

**Setting up key-based SSH access:**

1. **Generate a key pair** (if you don't have one):
   ```bash
   ssh-keygen -t ed25519 -C "pulse-monitor"
   ```
2. **Copy the public key** to each target machine:
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519.pub user@hostname
   ```
3. **Test** that you can connect without a password:
   ```bash
   ssh user@hostname "echo ok"
   ```
4. **Point Pulse** to the private key:
   ```bash
   export SSH_KEY_PATH=~/.ssh/id_ed25519
   ```

> **Tip:** The SSH user you specify must have permission to run `top`, `free`, `df`, and (optionally) `docker ps` / `docker inspect` on the target machine.

### Machine Inventory

Machines are managed through the web UI or the REST API:

**Via the UI:**
1. Open Pulse in your browser
2. Click **Add Machine** on the Dashboard
3. Enter the hostname/IP, SSH user, and an optional display name
4. Click **Add Machine** — Pulse will begin collecting metrics on the next cycle (≤60s)

**Via the API:**
```bash
# Add a machine
curl -X POST http://localhost:3000/api/machines \
  -H 'Content-Type: application/json' \
  -d '{"hostname": "192.168.1.10", "user": "pi", "name": "Raspberry Pi"}'

# List machines
curl http://localhost:3000/api/machines

# Delete a machine
curl -X DELETE http://localhost:3000/api/machines/1
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `SSH_KEY_PATH` | `~/.ssh/id_rsa` | Path to SSH private key |

### Database

Pulse uses **SQLite** (`pulse.db` in the project root). No external database required. The schema is created automatically on first run.

## Feature Overview

### 📊 Metrics Collection
- CPU, memory, and disk usage collected every 60 seconds via SSH
- Historical metrics with interactive bar charts
- 30-day uptime heatmap per machine

### 🔍 Anomaly Detection
- Automatic statistical anomaly detection on collected metrics
- Manual detection trigger via the Alerts tab
- Severity classification and timestamped history

### 📈 Capacity Forecasting
- Linear trend analysis on resource usage
- Warnings when metrics are projected to hit capacity
- "Days until full" estimates for disk and memory

### 🐳 Container Monitoring
- Lists Docker containers on each machine with state and health
- Auto-heal policies: configure max retries and grace periods
- Automatic restart of unhealthy/exited containers

### ⚙️ Settings & Notifications
- Manual data collection trigger
- Configurable notification toggles for offline machines, unhealthy containers, CPU/disk thresholds, anomalies, and forecast warnings

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/machines` | List all machines |
| `POST` | `/api/machines` | Add a machine |
| `DELETE` | `/api/machines/:id` | Delete a machine |
| `GET` | `/api/metrics/:machineId` | Get metrics history |
| `GET` | `/api/uptime/:machineId` | Get 30-day uptime data |
| `GET` | `/api/containers/:machineId` | List Docker containers |
| `POST` | `/api/containers/policy` | Update auto-heal policy |
| `GET` | `/api/anomalies` | List detected anomalies |
| `POST` | `/api/anomalies/detect` | Trigger anomaly detection |
| `GET` | `/api/forecasts` | Get capacity forecasts |
| `POST` | `/api/collect` | Trigger manual collection |

## Troubleshooting

- **"Could not read SSH key"** — Ensure `SSH_KEY_PATH` points to a valid private key file
- **Machine shows "offline"** — Verify SSH connectivity: `ssh user@host "echo ok"`
- **No metrics appearing** — Wait up to 60s for the first collection cycle, or trigger manually in Settings
- **Container tab empty** — Docker must be installed and the SSH user needs permission to run `docker` commands

## License

ISC
