# Audit Report: SSH Integration Layer (Task ID 3)

## Summary
**Status: Failed / Incomplete**

The implementation provides the core logic for SSH-based metrics collection but is missing critical components to function as a service. Specifically, there is no backend entry point (server/app) to run the collector loop or expose an API. The collector logic itself has robustness issues.

## Findings

### 1. Missing Backend Service
- **Critical:** There is no `index.js`, `server.js`, or `app.js` in the `backend/` directory or project root.
- The `package.json` points to `"main": "index.js"`, but this file does not exist.
- As a result, the collector cannot run automatically. It can only be executed manually via `node backend/collector.js`.

### 2. Code Robustness (backend/collector.js)
- **Timeouts:** The SSH connection (`conn.connect`) and command execution (`execCommand`) lack explicit timeouts. If a remote host hangs during `free` or `top`, the collector process will hang indefinitely for that machine.
- **Error Handling:** Metrics are only saved if **both** memory and disk parsing succeed (`if (mem && disk)`). If `top` fails (CPU parsing returns 0.0 but "succeeds"), or if `df` fails but `free` works, valid data is discarded.
- **Command Parsing:**
  - `parseCpu` relies on `top -bn1` output containing "Cpu(s)". This format is specific to certain `procps-ng` versions and may fail on minimal environments (e.g., Alpine/BusyBox) or different locales.
  - `parseDisk` assumes the root partition `/` is the only relevant disk metric.

### 3. Database Integration
- **Verified:** `backend/db.js` correctly initializes the SQLite database with `machines`, `metrics`, and `logs` tables. The schema matches the collector's queries.

### 4. Project Structure
- **Verified:** The project is a Node.js environment (`package.json` present), consistent with the "Node.js project" note.
- **Issue:** The `backend` folder is isolated. There is no integration with the frontend (no API endpoints to serve the collected data).

## Recommendations
1.  **Create Entry Point:** Initialize an Express server (`backend/index.js`) that:
    - Schedules the `runCollector` function (e.g., `setInterval`).
    - Exposes API endpoints (e.g., `/api/machines`, `/api/metrics/:id`) for the frontend.
2.  **Add Timeouts:** configure `readyTimeout` in `ssh2` connection and a `setTimeout` race in `execCommand`.
3.  **Improve Parsing:**
    - Use `/proc/meminfo` and `/proc/stat` (via `cat`) instead of `free`/`top` for more reliable, machine-readable parsing on Linux.
    - Handle partial metric failures (save what you can).
