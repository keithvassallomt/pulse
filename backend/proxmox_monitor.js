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
        // Verify connectivity and permissions first
        let connectionOk = false;
        let permissionWarning = null;
        try {
            const nodes = await proxmoxApiRequest(host, `/api2/json/nodes`);
            if (Array.isArray(nodes) && nodes.length > 0) {
                connectionOk = true;
                // Check if our node_name exists in the cluster
                const nodeExists = nodes.some(n => n.node === host.node_name);
                if (!nodeExists) {
                    const available = nodes.map(n => n.node).join(', ');
                    permissionWarning = `Node '${host.node_name}' not found. Available: ${available}`;
                    console.warn(`[Proxmox] ${permissionWarning}`);
                }
            }
        } catch (e) {
            permissionWarning = `API connectivity failed: ${e.message}`;
            console.warn(`[Proxmox] ${permissionWarning}`);
        }

        // Check token permissions
        try {
            const perms = await proxmoxApiRequest(host, `/api2/json/access/permissions`);
            if (perms && typeof perms === 'object' && Object.keys(perms).length === 0) {
                const warning = 'API token has no permissions assigned. Grant at least VM.Audit on / to see resources.';
                permissionWarning = permissionWarning ? `${permissionWarning}; ${warning}` : warning;
                console.warn(`[Proxmox] ${host.name}: ${warning}`);
            }
        } catch (e) {
            // Non-critical, skip
        }

        // Store warning in last_seen update
        if (permissionWarning) {
            await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`,
                [host.ssh_machine_id, 'WARN', `Proxmox ${host.name}: ${permissionWarning}`]);
        }

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

        // --- AUTO-LINKING: If ssh_machine_id is missing, try to find it by hostname/IP ---
        if (!host.ssh_machine_id) {
            try {
                const apiUrl = new URL(host.api_url);
                const apiHostname = apiUrl.hostname;
                console.log(`[Proxmox] Attempting auto-link for ${host.name} using hostname ${apiHostname}`);
                const machine = await dbGet(
                    `SELECT id FROM machines WHERE hostname = ? OR hostname LIKE ?`,
                    [apiHostname, `%${apiHostname}%`]
                );
                if (machine) {
                    console.log(`[Proxmox] Auto-linked host ${host.name} to machine ID ${machine.id} via hostname ${apiHostname}`);
                    await dbRun(`UPDATE proxmox_hosts SET ssh_machine_id = ? WHERE id = ?`, [machine.id, host.id]);
                    host.ssh_machine_id = machine.id;
                } else {
                    console.log(`[Proxmox] No matching machine found for hostname ${apiHostname}`);
                }
            } catch (e) {
                console.warn(`[Proxmox] Auto-link failed for ${host.name}: ${e.message}`);
            }
        }

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

        await dbRun(`UPDATE proxmox_hosts SET last_seen = CURRENT_TIMESTAMP, last_error = ? WHERE id = ?`,
            [permissionWarning || null, host.id]);
        console.log(`[Proxmox] Found ${allResources.length} resource(s) on ${host.name}`);

    } catch (err) {
        console.error(`[Proxmox] Collection failed for ${host.name}:`, err.message);
        await dbRun(`UPDATE proxmox_hosts SET last_error = ? WHERE id = ?`,
            [`Collection failed: ${err.message}`, host.id]);
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
    // Use pct exec with bash -lc to ensure a login-shell environment (mimicking 'pct enter')
    // This ensures PATH and other environment variables are properly set for tools like docker
    const escaped = command.replace(/'/g, "'\\''");
    const wrappedCmd = `pct exec ${vmid} -- bash -lc '${escaped}'`;
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

// --- Docker-in-LXC: Discover Docker containers inside running LXC containers ---

async function collectDockerInLxc(execCommand, conn, host) {
    const resources = await dbAll(
        `SELECT * FROM proxmox_resources WHERE proxmox_host_id = ? AND type = 'lxc' AND status = 'running'`,
        [host.id]
    );

    console.log(`[DEBUG] Found ${resources.length} running LXCs on Proxmox host ${host.name}`);

    for (const lxc of resources) {
        console.log(`[DEBUG] Probing LXC ${lxc.vmid} (${lxc.name}) for Docker...`);
        try {
            // Check if Docker is available inside this LXC using login shell
            const dockerCheck = await execInLxc(execCommand, conn, lxc.vmid, 'command -v docker', 3000);
            console.log(`[DEBUG] LXC ${lxc.vmid} Docker check: ${dockerCheck}`);
        } catch (e) {
            console.log(`[DEBUG] LXC ${lxc.vmid} No Docker or check failed: ${e.message}`);
            continue;
        }

        console.log(`[Proxmox] LXC ${lxc.vmid} (${lxc.name}) has Docker — enumerating containers...`);

        try {
            const psOutput = await execInLxc(
                execCommand, conn, lxc.vmid,
                "docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}'",
                10000
            );

            console.log(`[DEBUG] LXC ${lxc.vmid} docker ps output: ${psOutput}`);

            if (!psOutput || !psOutput.trim()) {
                console.log(`[DEBUG] LXC ${lxc.vmid} Empty docker ps output`);
                continue;
            }

            const containers = psOutput.trim().split('\n').map(line => {
                const parts = line.split('|');
                if (parts.length < 5) return null;
                return { id: parts[0], name: parts[1], image: parts[2], state: parts[3], status: parts[4] };
            }).filter(Boolean);

            // Use the Proxmox host's SSH machine_id as the parent machine
            const machineId = host.ssh_machine_id;
            if (!machineId) {
                console.warn(`[Proxmox] Host ${host.name} has no ssh_machine_id, skipping Docker-in-LXC storage`);
                continue;
            }

            for (const container of containers) {
                // Use a prefixed container_id to avoid collisions: lxc-<vmid>/<docker-id>
                const prefixedId = `lxc-${lxc.vmid}/${container.id}`;

                let healthStatus = 'unknown';
                if (container.state === 'running') {
                    try {
                        const h = await execInLxc(
                            execCommand, conn, lxc.vmid,
                            `docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' ${container.id}`,
                            5000
                        );
                        healthStatus = (h.trim() === 'none') ? null : h.trim();
                    } catch {
                        healthStatus = 'unknown';
                    }
                } else {
                    healthStatus = 'not_running';
                }

                // Upsert into containers table
                const existing = await dbGet(
                    `SELECT id FROM containers WHERE machine_id = ? AND container_id = ?`,
                    [machineId, prefixedId]
                );

                if (existing) {
                    await dbRun(
                        `UPDATE containers SET name = ?, image = ?, state = ?, status = ?, health_status = ?,
                         source_type = 'lxc', source_vmid = ?, proxmox_host_id = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
                        [container.name, container.image, container.state, container.status, healthStatus,
                         lxc.vmid, host.id, existing.id]
                    );
                } else {
                    await dbRun(
                        `INSERT INTO containers (machine_id, container_id, name, image, state, status, health_status,
                         source_type, source_vmid, proxmox_host_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'lxc', ?, ?)`,
                        [machineId, prefixedId, container.name, container.image, container.state, container.status,
                         healthStatus, lxc.vmid, host.id]
                    );
                }
            }

            console.log(`[Proxmox] Found ${containers.length} Docker container(s) inside LXC ${lxc.vmid} (${lxc.name})`);
        } catch (e) {
            console.warn(`[Proxmox] Failed to enumerate Docker in LXC ${lxc.vmid}: ${e.message}`);
        }
    }
}

// --- Snapshot Management ---

async function listSnapshots(host, vmid, type) {
    // Proxmox API: GET /nodes/{node}/{type}/{vmid}/snapshot
    // Returns array of snapshot objects
    try {
        const snapshots = await proxmoxApiRequest(host, `/api2/json/nodes/${host.node_name}/${type}/${vmid}/snapshot`);
        // Sort by snapshot time (if available) or name
        return snapshots.map(s => ({
            name: s.name,
            description: s.description,
            snaptime: s.snaptime, // Unix timestamp
            parent: s.parent,
            vmstate: s.vmstate, // 1 if RAM included
        })).sort((a, b) => (b.snaptime || 0) - (a.snaptime || 0));
    } catch (e) {
        throw new Error(`Failed to list snapshots for ${type} ${vmid}: ${e.message}`);
    }
}

async function createSnapshot(host, vmid, type, snapname, description = '') {
    // Proxmox API: POST /nodes/{node}/{type}/{vmid}/snapshot
    try {
        const path = `/api2/json/nodes/${host.node_name}/${type}/${vmid}/snapshot`;
        const url = new URL(path, host.api_url);
        const isHttps = url.protocol === 'https:';
        const mod = isHttps ? https : http;

        return new Promise((resolve, reject) => {
            const headers = { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json' 
            };
            if (host.token_id && host.token_secret) {
                headers['Authorization'] = `PVEAPIToken=${host.token_id}=${host.token_secret}`;
            }

            const body = new URLSearchParams({ snapname, description }).toString();
            headers['Content-Length'] = Buffer.byteLength(body);

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers,
                rejectUnauthorized: host.verify_ssl ? true : false,
            };

            const req = mod.request(options, (res) => {
                let respBody = '';
                res.on('data', chunk => respBody += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        return reject(new Error(`Proxmox API ${res.statusCode}: ${respBody}`));
                    }
                    try {
                        const json = JSON.parse(respBody);
                        resolve(json.data); // Returns task UPID
                    } catch (e) {
                        reject(new Error(`Invalid JSON from Proxmox API: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(body);
            req.end();
        });
    } catch (e) {
        throw new Error(`Failed to create snapshot for ${type} ${vmid}: ${e.message}`);
    }
}

async function rollbackSnapshot(host, vmid, type, snapname) {
    // Proxmox API: POST /nodes/{node}/{type}/{vmid}/snapshot/{snapname}/rollback
    try {
        const path = `/api2/json/nodes/${host.node_name}/${type}/${vmid}/snapshot/${snapname}/rollback`;
        const url = new URL(path, host.api_url);
        const isHttps = url.protocol === 'https:';
        const mod = isHttps ? https : http;

        return new Promise((resolve, reject) => {
            const headers = { 'Accept': 'application/json' };
            if (host.token_id && host.token_secret) {
                headers['Authorization'] = `PVEAPIToken=${host.token_id}=${host.token_secret}`;
            }

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers,
                rejectUnauthorized: host.verify_ssl ? true : false,
            };

            const req = mod.request(options, (res) => {
                let respBody = '';
                res.on('data', chunk => respBody += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        return reject(new Error(`Proxmox API ${res.statusCode}: ${respBody}`));
                    }
                    try {
                        const json = JSON.parse(respBody);
                        resolve(json.data);
                    } catch (e) {
                        // Sometimes simple OK
                        resolve(respBody);
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    } catch (e) {
        throw new Error(`Failed to rollback snapshot ${snapname}: ${e.message}`);
    }
}

async function deleteSnapshot(host, vmid, type, snapname) {
     // Proxmox API: DELETE /nodes/{node}/{type}/{vmid}/snapshot/{snapname}
    try {
        const path = `/api2/json/nodes/${host.node_name}/${type}/${vmid}/snapshot/${snapname}`;
        const url = new URL(path, host.api_url);
        const isHttps = url.protocol === 'https:';
        const mod = isHttps ? https : http;

        return new Promise((resolve, reject) => {
            const headers = { 'Accept': 'application/json' };
            if (host.token_id && host.token_secret) {
                headers['Authorization'] = `PVEAPIToken=${host.token_id}=${host.token_secret}`;
            }

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'DELETE',
                headers,
                rejectUnauthorized: host.verify_ssl ? true : false,
            };

            const req = mod.request(options, (res) => {
                let respBody = '';
                res.on('data', chunk => respBody += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        return reject(new Error(`Proxmox API ${res.statusCode}: ${respBody}`));
                    }
                    try {
                        const json = JSON.parse(respBody);
                        resolve(json.data);
                    } catch (e) {
                        resolve(respBody);
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    } catch (e) {
        throw new Error(`Failed to delete snapshot ${snapname}: ${e.message}`);
    }
}

module.exports = {
    runProxmoxCollector,
    collectJumpThroughMetrics,
    collectDockerInLxc,
    initProxmoxTables,
    execInLxc,
    execInVm,
    listSnapshots,
    createSnapshot,
    rollbackSnapshot,
    deleteSnapshot,
};
