const db = require('./db');

// Configuration
const LOOKBACK_DAYS = 7;
const MIN_DATA_POINTS = 10; // Need at least some history to make a recommendation

// Thresholds
const CPU_LOW_THRESHOLD = 15;   // If peak < 15%, suggest downscale
const CPU_HIGH_THRESHOLD = 90;  // If peak > 90%, suggest upscale
const MEM_LOW_THRESHOLD = 30;   // If peak < 30%, suggest downscale
const MEM_HIGH_THRESHOLD = 90;  // If peak > 90%, suggest upscale

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

async function getProxmoxRecommendations() {
    const recommendations = [];
    
    // Get all Proxmox resources that are currently known
    const resources = await dbAll(`
        SELECT id, proxmox_host_id, vmid, type, name, cpu_count, memory_total 
        FROM proxmox_resources 
        WHERE status = 'running'
    `);

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const sinceStr = since.toISOString();

    for (const res of resources) {
        // Get metrics history
        const metrics = await dbAll(`
            SELECT cpu_usage, memory_used 
            FROM proxmox_metrics 
            WHERE proxmox_host_id = ? AND vmid = ? AND type = ? AND timestamp > ?
            ORDER BY timestamp ASC
        `, [res.proxmox_host_id, res.vmid, res.type, sinceStr]);

        if (metrics.length < MIN_DATA_POINTS) continue;

        // Calculate Peaks
        let peakCpu = 0;
        let peakMem = 0;

        for (const m of metrics) {
            if (m.cpu_usage > peakCpu) peakCpu = m.cpu_usage;
            if (m.memory_used > peakMem) peakMem = m.memory_used;
        }

        // --- Analysis ---
        
        // 1. CPU Analysis
        // Note: cpu_usage in DB is 0-100 (percentage of allocated limit)
        // If it's consistently low, we might not need as many cores, but changing cores is coarse.
        // For now, just flag if usage is extremely low or high.
        
        if (peakCpu < CPU_LOW_THRESHOLD) {
            recommendations.push({
                resource_id: res.id,
                name: res.name,
                type: res.type, // 'lxc' or 'qemu'
                category: 'cpu',
                severity: 'info',
                message: `Over-provisioned CPU. Peak usage was only ${peakCpu.toFixed(1)}% in last ${LOOKBACK_DAYS} days.`,
                current_limit: `${res.cpu_count} Cores`,
                suggested_action: 'Consider reducing CPU cores or limit.'
            });
        } else if (peakCpu > CPU_HIGH_THRESHOLD) {
            recommendations.push({
                resource_id: res.id,
                name: res.name,
                type: res.type,
                category: 'cpu',
                severity: 'warning',
                message: `High CPU usage detected. Peak usage reached ${peakCpu.toFixed(1)}%.`,
                current_limit: `${res.cpu_count} Cores`,
                suggested_action: 'Consider increasing CPU cores.'
            });
        }

        // 2. Memory Analysis
        // memory_total is in MB
        if (res.memory_total > 0) {
            const peakMemPercent = (peakMem / res.memory_total) * 100;
            
            if (peakMemPercent < MEM_LOW_THRESHOLD) {
                // Suggest downscaling, but keep some buffer (e.g. peak + 20%)
                const suggested = Math.ceil(peakMem * 1.2); 
                recommendations.push({
                    resource_id: res.id,
                    name: res.name,
                    type: res.type,
                    category: 'memory',
                    severity: 'info',
                    message: `Over-provisioned Memory. Peak usage: ${peakMem}MB (${peakMemPercent.toFixed(1)}%).`,
                    current_limit: `${res.memory_total} MB`,
                    suggested_action: `Consider reducing memory to ~${suggested} MB.`
                });
            } else if (peakMemPercent > MEM_HIGH_THRESHOLD) {
                recommendations.push({
                    resource_id: res.id,
                    name: res.name,
                    type: res.type,
                    category: 'memory',
                    severity: 'warning',
                    message: `High Memory usage. Peak: ${peakMem}MB (${peakMemPercent.toFixed(1)}%).`,
                    current_limit: `${res.memory_total} MB`,
                    suggested_action: 'Consider increasing memory.'
                });
            }
        }
    }

    return recommendations;
}

async function getHostRecommendations() {
    const recommendations = [];
    
    // Get all Machines
    const machines = await dbAll(`SELECT id, name, hostname FROM machines`);
    
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const sinceStr = since.toISOString();

    for (const m of machines) {
        // Get metrics history
        const metrics = await dbAll(`
            SELECT cpu_usage, memory_used, memory_total 
            FROM metrics 
            WHERE machine_id = ? AND timestamp > ?
            ORDER BY timestamp ASC
        `, [m.id, sinceStr]);

        if (metrics.length < MIN_DATA_POINTS) continue;

        let peakCpu = 0;
        let peakMem = 0;
        let maxMemTotal = 0;

        for (const row of metrics) {
            if (row.cpu_usage > peakCpu) peakCpu = row.cpu_usage;
            if (row.memory_used > peakMem) peakMem = row.memory_used;
            if (row.memory_total > maxMemTotal) maxMemTotal = row.memory_total;
        }

        // CPU
        if (peakCpu > CPU_HIGH_THRESHOLD) {
            recommendations.push({
                resource_id: m.id,
                name: m.name,
                type: 'host',
                category: 'cpu',
                severity: 'warning',
                message: `Host under high CPU load. Peak: ${peakCpu.toFixed(1)}%.`,
                current_limit: 'N/A',
                suggested_action: 'Check running services or upgrade CPU.'
            });
        }

        // RAM
        if (maxMemTotal > 0) {
            const peakMemPercent = (peakMem / maxMemTotal) * 100;
             if (peakMemPercent > MEM_HIGH_THRESHOLD) {
                recommendations.push({
                    resource_id: m.id,
                    name: m.name,
                    type: 'host',
                    category: 'memory',
                    severity: 'warning',
                    message: `Host running low on RAM. Peak: ${peakMemPercent.toFixed(1)}%.`,
                    current_limit: `${(maxMemTotal / 1024).toFixed(1)} GB`,
                    suggested_action: 'Add more RAM or reduce workload.'
                });
             }
        }
    }
    return recommendations;
}

module.exports = {
    getProxmoxRecommendations,
    getHostRecommendations
};
