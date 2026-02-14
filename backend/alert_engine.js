const db = require('./db');
const notifier = require('./webhook_notifier');

// In-memory state: key -> { startTime: number, lastAlert: number }
const alertState = new Map();

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between notifications

// Helper: Promisify DB calls
const dbAll = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

/**
 * Evaluate metrics against active alert profiles for a specific machine.
 * @param {number} machineId 
 * @param {object} metrics { cpu_usage, memory_used, memory_total, disk_used, disk_total, load_1, ... }
 */
async function evaluateAlerts(machineId, metrics) {
  try {
    // 1. Fetch relevant profiles
    const profiles = await dbAll(
      `SELECT * FROM alert_profiles 
       WHERE enabled = 1 
       AND (target_type = 'global' OR (target_type = 'machine' AND target_id = ?))`,
      [String(machineId)]
    );

    if (!profiles || profiles.length === 0) return;

    // Fetch machine info for the alert message
    const machine = await dbGet('SELECT name, hostname FROM machines WHERE id = ?', [machineId]);
    const machineName = machine ? (machine.name || machine.hostname) : `ID ${machineId}`;

    const now = Date.now();

    for (const profile of profiles) {
      let value = null;

      // Extract metric value
      switch (profile.metric) {
        case 'cpu':
        case 'cpu_usage':
          value = metrics.cpu_usage;
          break;
        case 'memory':
        case 'memory_usage':
          if (metrics.memory_total > 0) {
            value = (metrics.memory_used / metrics.memory_total) * 100;
          }
          break;
        case 'disk':
        case 'disk_usage':
          if (metrics.disk_total > 0) {
            value = (metrics.disk_used / metrics.disk_total) * 100;
          }
          break;
        case 'load_1':
          value = metrics.load_1;
          break;
        case 'load_5':
          value = metrics.load_5;
          break;
        case 'load_15':
          value = metrics.load_15;
          break;
        default:
          continue; // Unknown metric
      }

      if (value === null || value === undefined) continue;

      // Check condition
      let triggered = false;
      switch (profile.condition) {
        case '>': triggered = value > profile.threshold; break;
        case '>=': triggered = value >= profile.threshold; break;
        case '<': triggered = value < profile.threshold; break;
        case '<=': triggered = value <= profile.threshold; break;
        case '=': triggered = value == profile.threshold; break;
      }

      const stateKey = `profile:${profile.id}:machine:${machineId}`;
      let state = alertState.get(stateKey);

      if (triggered) {
        if (!state) {
          state = { startTime: now, lastAlert: 0 };
          alertState.set(stateKey, state);
        }

        // Check duration (if condition must persist for X minutes)
        const durationMs = (profile.duration || 0) * 60 * 1000;
        const timeActive = now - state.startTime;

        if (timeActive >= durationMs) {
          // Check cooldown
          if (now - state.lastAlert >= COOLDOWN_MS) {
            // FIRE ALERT
            const emoji = profile.severity === 'critical' ? '🔴' : profile.severity === 'warning' ? '🟠' : 'ℹ️';
            
            await notifier.sendAlert({
              type: `custom_${profile.metric}`,
              severity: profile.severity,
              title: `${emoji} Alert: ${profile.name}`,
              message: `Metric '${profile.metric}' on ${machineName} is ${value.toFixed(1)} (Threshold: ${profile.condition} ${profile.threshold})`,
              machine: machineName
            });

            state.lastAlert = now;
            alertState.set(stateKey, state);
            console.log(`[AlertEngine] Triggered profile '${profile.name}' for ${machineName}`);
          }
        }
      } else {
        // Condition cleared
        if (state) {
          alertState.delete(stateKey);
        }
      }
    }
  } catch (err) {
    console.error(`[AlertEngine] Error evaluating alerts for machine ${machineId}:`, err);
  }
}

module.exports = { evaluateAlerts };
