const https = require('https');
const http = require('http');
const db = require('./db');

// --- DB helpers ---
const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
});
const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});
const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

// --- DB Schema Migration ---
function initProxmoxTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS proxmox_hosts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                api_url TEXT NOT NULL,
                node_name TEXT NOT NULL DEFAULT 'pve',
                token_id TEXT,
                token_secret TEXT,
                verify_ssl INTEGER DEFAULT 0,
                ssh_machine_id INTEGER,
                enabled INTEGER DEFAULT 1,
                last_seen DATETIME,
                FOREIGN KEY(ssh_machine_id) REFERENCES machines(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS proxmox_resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proxmox_host_id INTEGER NOT NULL,
                vmid INTEGER NOT NULL,
                type TEXT NOT NULL,
                name TEXT,
                status TEXT,
                cpu_usage REAL,
                cpu_count INTEGER,
                memory_used INTEGER,
                memory_total INTEGER,
                disk_used INTEGER,
                disk_total INTEGER,
                uptime INTEGER,
                netin INTEGER,
                netout INTEGER,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(proxmox_host_id) REFERENCES proxmox_hosts(id),
                UNIQUE(proxmox_host_id, vmid, type)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS proxmox_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proxmox_host_id INTEGER NOT NULL,
                vmid INTEGER NOT NULL,
                type TEXT NOT NULL,
                cpu_usage REAL,
                memory_used INTEGER,
                memory_total INTEGER,
                disk_used INTEGER,
                disk_total INTEGER,
                netin INTEGER,
                netout INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(proxmox_host_id) REFERENCES proxmox_hosts(id)
            )`, (err) => {
                if (err) reject(err); else resolve();
            });
        });
    });
}

// Init tables on load
initProxmoxTables().catch(err => console.error('Failed to init proxmox tables:', err));

// --- Proxmox API Client ---

function proxmoxApiRequest(host, path) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, host.api_url);
        const isHttps = url.protocol === 'https:';
        const mod = isHttps ? https : http;

        const headers = { 'Accept': 'application/json' };
        if (host.token_id && host.token_secret) {
            headers['Authorization'] = `PVEAPIToken=${host.token_id}=${host.token_secret}`;
        }

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + (url.search || ''),
            method: 'GET',
            headers,
            rejectUnauthorized: host.verify_ssl ? true : false,
            timeout: 10000,
        };

        const req = mod.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`Proxmox API ${res.statusCode}: ${body.slice(0, 200)}`));
                }
                try {
                    const json = JSON.parse(body);
                    resolve(json.data);
                } catch (e) {
                    reject(new Error(`Invalid JSON from Proxmox API: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Proxmox API request timeout')); });
        req.end();
    });
}

// --- Collect metrics for a single Proxmox host ---

async function collectProxmoxHost(host) {
    console.log(`[Proxmox] Collecting from ${host.name} (${host.api_url})...`);

    try {
        // Get LXC containers
        let lxcResources = [];
        try {
            lxcResources = await proxmoxApiRequest(host, `/api2/json/nodes/${host.node_name}/lxc`);
        } catch (e) {
            console.warn(`[Proxmox] Failed to get LXC list from ${host.name}: ${e.message}`);
        }

        // Get QEMU VMs
        let qemuResources = [];
        try {
            qemuResources = await proxmoxApiRequest(host, `/api2/json/nodes/${host.node_name}/qemu`);
        } catch (e) {
            console.warn(`[Proxmox] Failed to get QEMU list from ${host.name}: ${e.message}`);
        }

        const allResources = [
            ...lxcResources.map(r => ({ ...r, type: 'lxc' })),
            ...qemuResources.map(r => ({ ...r, type: 'qemu' })),
        ];

        for (const r of allResources) {
            const vmid = r.vmid;
            const type = r.type;
            const name = r.name || `${type}-${vmid}`;
            const status = r.status || 'unknown';

            // CPU: Proxmox returns fractional usage (0.0 - 1.0 per core)
            const cpuUsage = r.cpu != null ? Math.round(r.cpu * 100 * 100) / 100 : null;
            const cpuCount = r.cpus || r.maxcpu || null;

            // Memory: bytes
            const memUsed = r.mem != null ? Math.round(r.mem / (1024 * 1024)) : null; // MB
            const memTotal = r.maxmem != null ? Math.round(r.maxmem / (1024 * 1024)) : null; // MB

            // Disk: bytes
            const diskUsed = r.disk != null ? Math.round(r.disk / (1024 * 1024)) : null; // MB
            const diskTotal = r.maxdisk != null ? Math.round(r.maxdisk / (1024 * 1024)) : null; // MB

            const uptime = r.uptime || 0;
            const netin = r.netin || 0;
            const netout = r.netout || 0;

            // Upsert proxmox_resources
            const existing = await dbGet(
                `SELECT id FROM proxmox_resources WHERE proxmox_host_id = ? AND vmid = ? AND type = ?`,
                [host.id, vmid, type]
            );

            if (existing) {
                await dbRun(
                    `UPDATE proxmox_resources SET name = ?, status = ?, cpu_usage = ?, cpu_count = ?, 
                     memory_used = ?, memory_total = ?, disk_used = ?, disk_total = ?,
                     uptime = ?, netin = ?, netout = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
                    [name, status, cpuUsage, cpuCount, memUsed, memTotal, diskUsed, diskTotal, uptime, netin, netout, existing.id]
                );
            } else {
                await dbRun(
                    `INSERT INTO proxmox_resources (proxmox_host_id, vmid, type, name, status, cpu_usage, cpu_count,
                     memory_used, memory_total, disk_used, disk_total, uptime, netin, netout)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [host.id, vmid, type, name, status, cpuUsage, cpuCount, memUsed, memTotal, diskUsed, diskTotal, uptime, netin, netout]
                );
            }

            // Store historical metric
            if (status === 'running') {
                await dbRun(
                    `INSERT INTO proxmox_metrics (proxmox_host_id, vmid, type, cpu_usage, memory_used, memory_total,
                     disk_used, disk_total, netin, netout) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [host.id, vmid, type, cpuUsage, memUsed, memTotal, diskUsed, diskTotal, netin, netout]
                );
            }
        }

        // Mark stale resources as stopped (resources that disappeared from the API)
        const activeKeys = allResources.map(r => `${r.vmid}-${r.type}`);
        const allStored = await dbAll(
            `SELECT id, vmid, type FROM proxmox_resources WHERE proxmox_host_id = ?`, [host.id]
        );
        for (const stored of allStored) {
            if (!activeKeys.includes(`${stored.vmid}-${stored.type}`)) {
                await dbRun(`UPDATE proxmox_resources SET status = 'removed', last_updated = CURRENT_TIMESTAMP WHERE id = ?`, [stored.id]);
            }
        }

        await dbRun(`UPDATE proxmox_hosts SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [host.id]);
        console.log(`[Proxmox] Found ${allResources.length} resource(s) on ${host.name}`);

    } catch (err) {
        console.error(`[Proxmox] Collection failed for ${host.name}:`, err.message);
        await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`,
            [host.ssh_machine_id, 'ERROR', `Proxmox collection failed for ${host.name}: ${err.message}`]);
    }
}

// --- Run all Proxmox host collections ---

async function runProxmoxCollector() {
    try {
        const hosts = await dbAll(`SELECT * FROM proxmox_hosts WHERE enabled = 1`);
        if (hosts.length === 0) return;

        console.log(`[Proxmox] Collecting from ${hosts.length} host(s)...`);
        for (const host of hosts) {
            await collectProxmoxHost(host);
        }
        console.log(`[Proxmox] Collection complete.`);
    } catch (err) {
        console.error('[Proxmox] Collector error:', err);
    }
}

// --- Jump-through: Execute command inside LXC via Proxmox host SSH ---

async function execInLxc(execCommand, conn, vmid, command, timeoutMs = 5000) {
    // Use pct exec to run a command inside an LXC container through the Proxmox host
    const wrappedCmd = `pct exec ${vmid} -- ${command}`;
    return execCommand(conn, wrappedCmd, timeoutMs);
}

async function execInVm(execCommand, conn, vmid, command, timeoutMs = 10000) {
    // Use qm guest exec for VMs (requires qemu-guest-agent)
    const wrappedCmd = `qm guest exec ${vmid} -- ${command}`;
    try {
        const result = await execCommand(conn, wrappedCmd, timeoutMs);
        // qm guest exec returns JSON, parse the out-data
        try {
            const parsed = JSON.parse(result);
            return parsed['out-data'] || '';
        } catch {
            return result;
        }
    } catch (e) {
        // Guest agent may not be available
        throw new Error(`VM ${vmid} guest exec failed (guest agent may not be installed): ${e.message}`);
    }
}

// Collect deeper metrics from inside LXC containers via jump-through
async function collectJumpThroughMetrics(execCommand, conn, host) {
    const resources = await dbAll(
        `SELECT * FROM proxmox_resources WHERE proxmox_host_id = ? AND status = 'running'`,
        [host.id]
    );

    for (const r of resources) {
        if (r.type === 'lxc') {
            try {
                // Get load average from inside the container
                const loadOut = await execInLxc(execCommand, conn, r.vmid, 'cat /proc/loadavg', 3000);
                const parts = loadOut.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const load1 = parseFloat(parts[0]) || 0;
                    // Store as a log note (could extend schema later)
                    console.log(`[Proxmox] LXC ${r.vmid} (${r.name}) load: ${load1}`);
                }
            } catch (e) {
                // Non-critical, skip silently
            }
        }
        // VM jump-through is less reliable (needs guest agent), skip by default
    }
}

module.exports = {
    runProxmoxCollector,
    collectJumpThroughMetrics,
    initProxmoxTables,
    execInLxc,
    execInVm,
};
