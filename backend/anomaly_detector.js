/**
 * Lightweight Z-score anomaly detection for CPU and RAM metrics.
 * 
 * Analyses a sliding window of historical data points per machine,
 * calculates mean & standard deviation, and flags values whose
 * Z-score exceeds a configurable threshold.
 */

const db = require('./db');

// --- Configuration (overridable via env) ---
const WINDOW_SIZE = parseInt(process.env.ANOMALY_WINDOW_SIZE) || 100;
const Z_THRESHOLD = parseFloat(process.env.ANOMALY_Z_THRESHOLD) || 3.0;
// Minimum data points needed before we start flagging
const MIN_DATA_POINTS = parseInt(process.env.ANOMALY_MIN_POINTS) || 10;

// --- Helpers ---

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr, avg) {
  if (arr.length < 2) return 0;
  const squaredDiffs = arr.map(v => (v - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

function zScore(value, avg, sd) {
  if (sd === 0) return 0; // no variance → no anomaly
  return (value - avg) / sd;
}

// --- DB helpers (promise wrappers) ---

const dbAll = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const dbRun = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

// --- Ensure anomalies table exists ---

function initAnomalyTable() {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER,
      metric TEXT NOT NULL,
      value REAL,
      z_score REAL,
      mean REAL,
      stddev REAL,
      threshold REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(machine_id) REFERENCES machines(id)
    )`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// --- Core analysis ---

/**
 * Analyse the latest metric for a given machine against its history.
 * Returns an array of anomaly objects (may be empty).
 */
async function analyseMetrics(machineId) {
  const rows = await dbAll(
    `SELECT cpu_usage, memory_used, memory_total FROM metrics
     WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [machineId, WINDOW_SIZE]
  );

  if (rows.length < MIN_DATA_POINTS) {
    return []; // not enough data yet
  }

  const latest = rows[0];
  const anomalies = [];

  // --- CPU ---
  const cpuValues = rows.map(r => r.cpu_usage).filter(v => v != null);
  if (cpuValues.length >= MIN_DATA_POINTS) {
    const avg = mean(cpuValues);
    const sd = stddev(cpuValues, avg);
    const z = zScore(latest.cpu_usage, avg, sd);
    if (Math.abs(z) > Z_THRESHOLD) {
      anomalies.push({
        machine_id: machineId,
        metric: 'cpu_usage',
        value: latest.cpu_usage,
        z_score: z,
        mean: avg,
        stddev: sd,
        threshold: Z_THRESHOLD
      });
    }
  }

  // --- RAM (percentage) ---
  const ramPcts = rows
    .filter(r => r.memory_total > 0 && r.memory_used != null)
    .map(r => (r.memory_used / r.memory_total) * 100);

  if (ramPcts.length >= MIN_DATA_POINTS) {
    const currentPct = latest.memory_total > 0
      ? (latest.memory_used / latest.memory_total) * 100
      : null;

    if (currentPct !== null) {
      const avg = mean(ramPcts);
      const sd = stddev(ramPcts, avg);
      const z = zScore(currentPct, avg, sd);
      if (Math.abs(z) > Z_THRESHOLD) {
        anomalies.push({
          machine_id: machineId,
          metric: 'memory_usage',
          value: currentPct,
          z_score: z,
          mean: avg,
          stddev: sd,
          threshold: Z_THRESHOLD
        });
      }
    }
  }

  return anomalies;
}

/**
 * Run anomaly detection for a single machine, persist any anomalies,
 * and return them.
 */
async function detectAnomalies(machineId) {
  await initAnomalyTable();
  const anomalies = await analyseMetrics(machineId);

  for (const a of anomalies) {
    await dbRun(
      `INSERT INTO anomalies (machine_id, metric, value, z_score, mean, stddev, threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.machine_id, a.metric, a.value, a.z_score, a.mean, a.stddev, a.threshold]
    );
    console.log(
      `⚠️  ANOMALY [${a.metric}] machine=${a.machine_id} value=${a.value.toFixed(1)} ` +
      `z=${a.z_score.toFixed(2)} mean=${a.mean.toFixed(1)} sd=${a.stddev.toFixed(1)}`
    );
  }

  return anomalies;
}

/**
 * Run anomaly detection across ALL machines. Returns a flat array of anomalies.
 */
async function detectAllAnomalies() {
  await initAnomalyTable();
  const machines = await dbAll('SELECT id FROM machines', []);
  const all = [];
  for (const m of machines) {
    const anomalies = await detectAnomalies(m.id);
    all.push(...anomalies);
  }
  return all;
}

/**
 * Get recent anomalies from the DB (for API consumption).
 */
async function getRecentAnomalies(machineId, limit = 50) {
  await initAnomalyTable();
  if (machineId) {
    return dbAll(
      `SELECT * FROM anomalies WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?`,
      [machineId, limit]
    );
  }
  return dbAll(
    `SELECT a.*, m.hostname FROM anomalies a
     LEFT JOIN machines m ON a.machine_id = m.id
     ORDER BY a.timestamp DESC LIMIT ?`,
    [limit]
  );
}

// --- Exports ---
module.exports = {
  detectAnomalies,
  detectAllAnomalies,
  getRecentAnomalies,
  initAnomalyTable,
  // Expose internals for testing
  _internals: { mean, stddev, zScore, analyseMetrics, WINDOW_SIZE, Z_THRESHOLD, MIN_DATA_POINTS }
};
