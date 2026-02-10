# Pulse Backend Collector

This service collects system metrics from remote machines via SSH.

## Prerequisites

- Node.js
- SSH access to target machines (using key-based authentication)
- `sqlite3` database

## Configuration

1.  Ensure `~/.ssh/id_rsa` exists or set `SSH_KEY_PATH` environment variable.
2.  Add machines to the `machines` table in `pulse.db`.

## Usage

To run the collector manually:

```bash
node backend/collector.js
```

To integrate into an application, require the module:

```javascript
const { runCollector } = require('./backend/collector');

// Run every minute
setInterval(runCollector, 60000);
```

## Metrics Collected

- CPU Usage (100 - idle)
- Memory Usage (Total, Used)
- Disk Usage (Root partition)
