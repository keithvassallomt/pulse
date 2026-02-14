const db = require('./db');

const RETENTION_DAYS = 90;

/**
 * Prunes metrics and logs older than the retention period.
 * @returns {Promise<Object>} Summary of deleted counts per table.
 */
function pruneOldMetrics() {
    return new Promise((resolve, reject) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
        const cutoffTimestamp = cutoffDate.toISOString();

        console.log(`[Pruner] Starting pruning cycle. Cutoff: ${cutoffTimestamp}`);

        const tables = [
            'metrics',
            'proxmox_metrics',
            'logs',
            'alert_history'
        ];

        let results = {};
        let completed = 0;
        let errors = [];

        tables.forEach(table => {
            // Using a simple DELETE query.
            // SQLite handles this efficiently enough for typical loads.
            // For very large datasets, we might want to LIMIT deletions, but given this runs daily, it should be fine.
            const sql = `DELETE FROM ${table} WHERE timestamp < ?`;
            
            db.run(sql, [cutoffTimestamp], function(err) {
                if (err) {
                    console.error(`[Pruner] Error pruning ${table}:`, err.message);
                    errors.push({ table, error: err.message });
                } else {
                    if (this.changes > 0) {
                        console.log(`[Pruner] Deleted ${this.changes} old records from ${table}`);
                    }
                    results[table] = this.changes;
                }

                completed++;
                if (completed === tables.length) {
                    if (errors.length > 0) {
                        // If all failed, reject, otherwise resolve with what we have
                        if (errors.length === tables.length) {
                            reject(new Error(`Pruning failed for all tables: ${JSON.stringify(errors)}`));
                        } else {
                            resolve({ results, errors });
                        }
                    } else {
                        resolve(results);
                    }
                }
            });
        });
    });
}

/**
 * Starts the pruning scheduler.
 * Runs once immediately on start, then every 24 hours.
 */
function startPruner() {
    // Run immediately on startup (or delay slightly to let startup finish)
    setTimeout(() => {
        pruneOldMetrics().catch(err => console.error('[Pruner] Initial run failed:', err));
    }, 60000); // Wait 1 minute after boot to not compete with initial collection

    // Schedule daily run (24 * 60 * 60 * 1000 ms)
    const DAY_IN_MS = 86400000;
    setInterval(() => {
        pruneOldMetrics().catch(err => console.error('[Pruner] Scheduled run failed:', err));
    }, DAY_IN_MS);
    
    console.log(`[Pruner] Pruning scheduled (Daily, retention: ${RETENTION_DAYS} days)`);
}

module.exports = {
    pruneOldMetrics,
    startPruner,
    RETENTION_DAYS
};
