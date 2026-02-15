/**
 * Predictive Capacity Planning - Forecaster Service
 * 
 * Uses simple linear regression on historical metrics to forecast
 * when disk or RAM will reach 100% capacity per machine.
 */

const db = require('./db');

// Configurable threshold (days) - warn if capacity full within this many days
const WARNING_THRESHOLD_DAYS = parseInt(process.env.FORECAST_WARNING_DAYS) || 30;

// Minimum data points needed for a meaningful regression
const MIN_DATA_POINTS = 5;

// How many hours of history to use for regression (default 7 days)
const HISTORY_HOURS = parseInt(process.env.FORECAST_HISTORY_HOURS) || 168;

// --- DB helpers ---
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
 * Simple linear regression: y = slope * x + intercept
 * x values are time offsets in days from the first data point.
 * Returns { slope, intercept, r2 }
 */
function linearRegression(points) {
    const n = points.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const { x, y } of points) {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R² (coefficient of determination)
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (const { x, y } of points) {
        const yPred = slope * x + intercept;
        ssRes += (y - yPred) ** 2;
        ssTot += (y - yMean) ** 2;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    return { slope, intercept, r2 };
}

/**
 * Given a regression result and current usage %, estimate days until 100%.
 * Returns null if usage is decreasing or stable (won't reach 100%).
 */
function daysUntilFull(regression, latestX) {
    if (!regression || regression.slope <= 0) return null;

    const currentY = regression.slope * latestX + regression.intercept;
    const remaining = 100 - currentY;
    if (remaining <= 0) return 0; // already full

    return remaining / regression.slope; // slope is in %/day
}

/**
 * Fetch historical metrics for a machine and compute forecasts.
 */
async function forecastForMachine(machineId) {
    const cutoff = new Date(Date.now() - HISTORY_HOURS * 3600 * 1000).toISOString();

    const rows = await dbAll(
        `SELECT memory_used, memory_total, disk_used, disk_total, cpu_usage, timestamp
         FROM metrics
         WHERE machine_id = ? AND timestamp >= ?
         ORDER BY timestamp ASC`,
        [machineId, cutoff]
    );

    if (rows.length < MIN_DATA_POINTS) {
        return null; // not enough data
    }

    // Convert timestamps to day offsets from first point
    const t0 = new Date(rows[0].timestamp).getTime();
    const MS_PER_DAY = 86400000;

    const memPoints = [];
    const diskPoints = [];
    const cpuPoints = [];

    for (const row of rows) {
        const x = (new Date(row.timestamp).getTime() - t0) / MS_PER_DAY;

        if (row.memory_total > 0) {
            memPoints.push({ x, y: (row.memory_used / row.memory_total) * 100 });
        }
        if (row.disk_total > 0) {
            diskPoints.push({ x, y: (row.disk_used / row.disk_total) * 100 });
        }
        if (typeof row.cpu_usage === 'number') {
            cpuPoints.push({ x, y: row.cpu_usage });
        }
    }

    const result = {};

    // Memory forecast
    if (memPoints.length >= MIN_DATA_POINTS) {
        const reg = linearRegression(memPoints);
        const latestX = memPoints[memPoints.length - 1].x;
        const daysLeft = daysUntilFull(reg, latestX);
        const currentPct = memPoints[memPoints.length - 1].y;

        result.memory = {
            currentPct: Math.round(currentPct * 10) / 10,
            slope: reg ? Math.round(reg.slope * 1000) / 1000 : 0, // %/day
            r2: reg ? Math.round(reg.r2 * 1000) / 1000 : 0,
            daysUntilFull: daysLeft !== null ? Math.round(daysLeft * 10) / 10 : null,
            warning: daysLeft !== null && daysLeft <= WARNING_THRESHOLD_DAYS
        };
    }

    // Disk forecast
    if (diskPoints.length >= MIN_DATA_POINTS) {
        const reg = linearRegression(diskPoints);
        const latestX = diskPoints[diskPoints.length - 1].x;
        const daysLeft = daysUntilFull(reg, latestX);
        const currentPct = diskPoints[diskPoints.length - 1].y;

        result.disk = {
            currentPct: Math.round(currentPct * 10) / 10,
            slope: reg ? Math.round(reg.slope * 1000) / 1000 : 0,
            r2: reg ? Math.round(reg.r2 * 1000) / 1000 : 0,
            daysUntilFull: daysLeft !== null ? Math.round(daysLeft * 10) / 10 : null,
            warning: daysLeft !== null && daysLeft <= WARNING_THRESHOLD_DAYS
        };
    }

    // CPU forecast
    if (cpuPoints.length >= MIN_DATA_POINTS) {
        const reg = linearRegression(cpuPoints);
        const latestX = cpuPoints[cpuPoints.length - 1].x;
        const daysLeft = daysUntilFull(reg, latestX);
        const currentPct = cpuPoints[cpuPoints.length - 1].y;

        result.cpu = {
            currentPct: Math.round(currentPct * 10) / 10,
            slope: reg ? Math.round(reg.slope * 1000) / 1000 : 0,
            r2: reg ? Math.round(reg.r2 * 1000) / 1000 : 0,
            daysUntilFull: daysLeft !== null ? Math.round(daysLeft * 10) / 10 : null,
            warning: daysLeft !== null && daysLeft <= WARNING_THRESHOLD_DAYS
        };
    }

    return Object.keys(result).length > 0 ? result : null;
}

/**
 * Run forecasts for all machines. Returns array of forecast objects.
 */
async function runForecasts() {
    const machines = await dbAll('SELECT id, name, hostname FROM machines');
    const forecasts = [];

    for (const machine of machines) {
        try {
            const forecast = await forecastForMachine(machine.id);
            if (forecast) {
                const hasWarning =
                    (forecast.memory && forecast.memory.warning) ||
                    (forecast.disk && forecast.disk.warning) ||
                    (forecast.cpu && forecast.cpu.warning);

                forecasts.push({
                    machineId: machine.id,
                    machineName: machine.name || machine.hostname,
                    hostname: machine.hostname,
                    ...forecast,
                    hasWarning,
                    warningThresholdDays: WARNING_THRESHOLD_DAYS,
                    generatedAt: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error(`Forecast failed for machine ${machine.id}:`, err.message);
        }
    }

    return forecasts;
}

module.exports = {
    linearRegression,
    daysUntilFull,
    forecastForMachine,
    runForecasts,
    WARNING_THRESHOLD_DAYS
};
