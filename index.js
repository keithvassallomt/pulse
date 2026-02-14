require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { runCollector } = require('./backend/collector');
const db = require('./backend/db');
const { getRecentAnomalies, detectAllAnomalies } = require('./backend/anomaly_detector');
const { runForecasts } = require('./backend/forecaster');
const { runAlertChecks, testWebhook } = require('./backend/webhook_notifier');
const { attachTerminalProxy } = require('./backend/terminal_proxy');
const { runProxmoxCollector } = require('./backend/proxmox_monitor');

const app = express();
const PORT = process.env.PORT || 3000;
const COLLECTOR_INTERVAL_MS = 60000; // 60 seconds

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// --- API Documentation ---
/*
  GET /health
    - Check API status
    - Returns: { status: 'ok', timestamp: '...' }

  GET /api/machines
    - List all monitored machines
    - Returns: [ { id, hostname, user, status, last_seen }, ... ]

  POST /api/machines
    - Add a new machine to monitor
    - Body: { hostname: '192.168.1.10', user: 'pi' }
    - Returns: { id: 1, hostname, user, status: 'unknown' }

  GET /api/machines/:id
    - Get details for a single machine
    - Returns: { id, hostname, user, status, last_seen }

  DELETE /api/machines/:id
    - Remove a machine
    - Returns: { message: 'Machine deleted', id: 1 }

  GET /api/metrics/:machineId
    - Get historical metrics for a machine
    - Query Params: limit (default 100), offset (default 0)
    - Returns: [ { id, machine_id, cpu_usage, memory_usage, ... }, ... ]

  POST /api/collect
    - Trigger immediate data collection
    - Returns: { message: 'Collection cycle triggered' }
*/

// --- API Endpoints ---

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// List machines with latest metrics
app.get('/api/machines', (req, res) => {
    const query = `
        SELECT 
            m.*,
            mt.cpu_usage,
            mt.memory_used,
            mt.memory_total,
            mt.disk_used,
            mt.disk_total,
            mt.load_1,
            mt.load_5,
            mt.load_15,
            mt.zfs_used,
            mt.zfs_total,
            mt.zfs_health
        FROM machines m
        LEFT JOIN (
            SELECT machine_id, cpu_usage, memory_used, memory_total, disk_used, disk_total,
                   load_1, load_5, load_15, zfs_used, zfs_total, zfs_health
            FROM metrics 
            WHERE id IN (
                SELECT MAX(id) 
                FROM metrics 
                GROUP BY machine_id
            )
        ) mt ON m.id = mt.machine_id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching machines:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Calculate percentages if data exists
        const enhancedRows = rows.map(row => {
            let memory_usage = null;
            let disk_usage = null;

            if (row.memory_total > 0 && row.memory_used !== null) {
                memory_usage = Math.round((row.memory_used / row.memory_total) * 100);
            }
            
            if (row.disk_total > 0 && row.disk_used !== null) {
                disk_usage = Math.round((row.disk_used / row.disk_total) * 100);
            }

            return {
                ...row,
                memory_usage,
                disk_usage
            };
        });

        res.json({ data: enhancedRows });
    });
});

// Get single machine
app.get('/api/machines/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM machines WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching machine:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Machine not found' });
        }
        res.json({ data: row });
    });
});

// Add machine
app.post('/api/machines', (req, res) => {
    const { hostname, user } = req.body;
    if (!hostname || !user) {
        return res.status(400).json({ error: 'Hostname and user are required' });
    }
    
    // Default name to hostname if not provided
    const machineName = req.body.name || hostname;

    // Check for duplicates first (optional but good practice)
    db.get('SELECT id FROM machines WHERE hostname = ?', [hostname], (err, row) => {
        if (err) {
             console.error('Error checking duplicate:', err);
             return res.status(500).json({ error: 'Internal server error' });
        }
        if (row) {
            return res.status(409).json({ error: 'Machine with this hostname already exists' });
        }

        const stmt = db.prepare('INSERT INTO machines (name, hostname, user, status) VALUES (?, ?, ?, ?)');
        stmt.run(machineName, hostname, user, 'unknown', function(err) {
            if (err) {
                console.error('Error adding machine:', err);
                return res.status(500).json({ error: 'Failed to add machine: ' + err.message });
            }
            res.status(201).json({ 
                data: { 
                    id: this.lastID, 
                    name: machineName,
                    hostname, 
                    user, 
                    status: 'unknown' 
                } 
            });
        });
        stmt.finalize();
    });
});

// Delete machine
app.delete('/api/machines/:id', (req, res) => {
    const { id } = req.params;
    
    // First check if it exists
    db.get('SELECT id FROM machines WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching machine for delete:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Machine not found' });
        }

        // Delete metrics first (cascade usually handles this but being explicit is safe for SQLite without FKs enabled)
        db.run('DELETE FROM metrics WHERE machine_id = ?', [id], (err) => {
            if (err) {
                console.error('Error deleting metrics:', err);
                return res.status(500).json({ error: 'Failed to clean up metrics' });
            }

            // Delete containers and their policies
            db.run('DELETE FROM container_policies WHERE container_table_id IN (SELECT id FROM containers WHERE machine_id = ?)', [id], (err) => {
                if (err) console.error('Error deleting container policies:', err);
                
                db.run('DELETE FROM containers WHERE machine_id = ?', [id], (err) => {
                    if (err) console.error('Error deleting containers:', err);

                    db.run('DELETE FROM machines WHERE id = ?', [id], function(err) {
                        if (err) {
                            console.error('Error deleting machine:', err);
                            return res.status(500).json({ error: 'Failed to delete machine' });
                        }
                        res.json({ message: 'Machine deleted', id });
                    });
                });
            });
        });
    });
});

// Get metrics for a machine (with pagination)
app.get('/api/metrics/:machineId', (req, res) => {
    const { machineId } = req.params;
    let limit = parseInt(req.query.limit) || 100;
    let offset = parseInt(req.query.offset) || 0;
    
    // Hard cap limit to prevent massive fetches
    if (limit > 1000) limit = 1000;

    // Get total count for pagination metadata
    db.get('SELECT COUNT(*) as total FROM metrics WHERE machine_id = ?', [machineId], (err, row) => {
        if (err) {
            console.error('Error counting metrics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        const total = row.total;

        db.all('SELECT * FROM metrics WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?', 
            [machineId, limit, offset], 
            (err, rows) => {
                if (err) {
                    console.error('Error fetching metrics:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.json({ 
                    data: rows,
                    pagination: { 
                        limit, 
                        offset, 
                        total,
                        page: Math.floor(offset / limit) + 1,
                        pages: Math.ceil(total / limit)
                    }
                });
            }
        );
    });
});

// Get nested containers tree: Proxmox Host -> LXC -> Docker Containers
app.get('/api/containers/nested', (req, res) => {
    // Get all proxmox hosts
    db.all('SELECT * FROM proxmox_hosts WHERE enabled = 1 ORDER BY name', [], (err, hosts) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        // Get all LXC resources
        db.all(
            `SELECT * FROM proxmox_resources WHERE type = 'lxc' ORDER BY proxmox_host_id, vmid`,
            [],
            (err, lxcResources) => {
                if (err) return res.status(500).json({ error: 'Internal server error' });

                // Get all Docker containers that came from LXC
                db.all(
                    `SELECT c.*, cp.max_retries, cp.grace_period, cp.current_retries, cp.last_restart
                     FROM containers c
                     LEFT JOIN container_policies cp ON c.id = cp.container_table_id
                     WHERE c.source_type = 'lxc'
                     ORDER BY c.proxmox_host_id, c.source_vmid, c.name`,
                    [],
                    (err, dockerContainers) => {
                        if (err) return res.status(500).json({ error: 'Internal server error' });

                        // Build the nested tree
                        const tree = hosts.map(host => {
                            const hostLxcs = lxcResources.filter(r => r.proxmox_host_id === host.id);
                            return {
                                ...host,
                                lxc_containers: hostLxcs.map(lxc => ({
                                    ...lxc,
                                    docker_containers: dockerContainers.filter(
                                        dc => dc.proxmox_host_id === host.id && dc.source_vmid === lxc.vmid
                                    ),
                                })),
                            };
                        });

                        res.json({ data: tree });
                    }
                );
            }
        );
    });
});

// Get containers for a machine
app.get('/api/containers/:machineId', (req, res) => {
    const { machineId } = req.params;
    
    const query = `
        SELECT 
            c.*,
            cp.max_retries,
            cp.grace_period,
            cp.current_retries,
            cp.last_restart
        FROM containers c
        LEFT JOIN container_policies cp ON c.id = cp.container_table_id
        WHERE c.machine_id = ? AND c.image != 'QEMU VM'
    `;

    db.all(query, [machineId], (err, rows) => {
        if (err) {
            console.error('Error fetching containers:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ data: rows });
    });
});

// Update container policy
app.post('/api/containers/policy', (req, res) => {
    const { containerId, maxRetries, gracePeriod } = req.body;

    if (!containerId) {
        return res.status(400).json({ error: 'Container ID is required' });
    }

    // Check if policy exists
    db.get('SELECT id FROM container_policies WHERE container_table_id = ?', [containerId], (err, row) => {
        if (err) {
            console.error('Error checking policy:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (row) {
            // Update
            const sql = `UPDATE container_policies SET max_retries = ?, grace_period = ? WHERE id = ?`;
            db.run(sql, [maxRetries || 3, gracePeriod || 60, row.id], function(err) {
                if (err) {
                    console.error('Error updating policy:', err);
                    return res.status(500).json({ error: 'Failed to update policy' });
                }
                res.json({ message: 'Policy updated', id: row.id });
            });
        } else {
            // Insert
            const sql = `INSERT INTO container_policies (container_table_id, max_retries, grace_period) VALUES (?, ?, ?)`;
            db.run(sql, [containerId, maxRetries || 3, gracePeriod || 60], function(err) {
                if (err) {
                    console.error('Error creating policy:', err);
                    return res.status(500).json({ error: 'Failed to create policy' });
                }
                res.json({ message: 'Policy created', id: this.lastID });
            });
        }
    });
});

// Get anomalies (all or per machine)
app.get('/api/anomalies', async (req, res) => {
    try {
        const machineId = req.query.machineId || null;
        const limit = parseInt(req.query.limit) || 50;
        const anomalies = await getRecentAnomalies(machineId, limit);
        res.json({ data: anomalies });
    } catch (err) {
        console.error('Error fetching anomalies:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Trigger anomaly detection manually
app.post('/api/anomalies/detect', async (req, res) => {
    try {
        const anomalies = await detectAllAnomalies();
        res.json({ data: anomalies, count: anomalies.length });
    } catch (err) {
        console.error('Error running anomaly detection:', err);
        res.status(500).json({ error: 'Detection failed: ' + err.message });
    }
});

// Get capacity forecasts
app.get('/api/forecasts', async (req, res) => {
    try {
        const forecasts = await runForecasts();
        const warnings = forecasts.filter(f => f.hasWarning);
        res.json({ data: forecasts, warnings: warnings.length });
    } catch (err) {
        console.error('Error generating forecasts:', err);
        res.status(500).json({ error: 'Forecast generation failed: ' + err.message });
    }
});

// Uptime history for a machine (last 30 days)
app.get('/api/uptime/:machineId', (req, res) => {
    const { machineId } = req.params;
    const days = parseInt(req.query.days) || 30;

    // Get metric timestamps for the last N days to determine uptime periods
    // The collector runs every 60s, so each metric row ≈ 1 minute of uptime
    const query = `
        SELECT 
            DATE(timestamp) as date,
            COUNT(*) as samples,
            MIN(timestamp) as first_seen,
            MAX(timestamp) as last_seen
        FROM metrics 
        WHERE machine_id = ? 
          AND timestamp >= datetime('now', '-${days} days')
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    `;

    db.all(query, [machineId], (err, rows) => {
        if (err) {
            console.error('Error fetching uptime:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Build a complete 30-day map
        const dayMap = {};
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            dayMap[key] = { date: key, samples: 0, uptimeMinutes: 0, uptimePct: 0 };
        }

        // Each sample ≈ 1 minute (collector interval = 60s)
        // Max expected samples per day = 1440
        for (const row of rows) {
            if (dayMap[row.date]) {
                const minutes = Math.min(row.samples, 1440);
                dayMap[row.date].samples = row.samples;
                dayMap[row.date].uptimeMinutes = minutes;
                dayMap[row.date].uptimePct = Math.round((minutes / 1440) * 100);
            }
        }

        res.json({ data: Object.values(dayMap) });
    });
});

// Cluster-wide aggregated metrics
app.get('/api/cluster', (req, res) => {
    const query = `
        SELECT 
            m.id,
            m.name,
            m.hostname,
            m.status,
            mt.cpu_usage,
            mt.memory_used,
            mt.memory_total,
            mt.disk_used,
            mt.disk_total,
            mt.load_1,
            mt.load_5,
            mt.load_15,
            mt.zfs_used,
            mt.zfs_total,
            mt.zfs_health
        FROM machines m
        LEFT JOIN (
            SELECT machine_id, cpu_usage, memory_used, memory_total, disk_used, disk_total,
                   load_1, load_5, load_15, zfs_used, zfs_total, zfs_health
            FROM metrics 
            WHERE id IN (
                SELECT MAX(id) 
                FROM metrics 
                GROUP BY machine_id
            )
        ) mt ON m.id = mt.machine_id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching cluster metrics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const onlineMachines = rows.filter(r => r.status === 'online');
        const totalMachines = rows.length;

        let totalMemoryUsed = 0;
        let totalMemoryTotal = 0;
        let totalDiskUsed = 0;
        let totalDiskTotal = 0;
        let cpuSum = 0;
        let cpuCount = 0;

        for (const row of rows) {
            if (row.memory_used != null) totalMemoryUsed += row.memory_used;
            if (row.memory_total != null) totalMemoryTotal += row.memory_total;
            if (row.disk_used != null) totalDiskUsed += row.disk_used;
            if (row.disk_total != null) totalDiskTotal += row.disk_total;
            if (row.cpu_usage != null) {
                cpuSum += row.cpu_usage;
                cpuCount++;
            }
        }

        const avgCpuUsage = cpuCount > 0 ? Math.round((cpuSum / cpuCount) * 10) / 10 : null;
        const memoryUsagePct = totalMemoryTotal > 0 ? Math.round((totalMemoryUsed / totalMemoryTotal) * 100) : null;
        const diskUsagePct = totalDiskTotal > 0 ? Math.round((totalDiskUsed / totalDiskTotal) * 100) : null;

        res.json({
            data: {
                totalMachines,
                onlineMachines: onlineMachines.length,
                cpu: {
                    avgUsage: avgCpuUsage,
                    machinesReporting: cpuCount,
                },
                memory: {
                    used: totalMemoryUsed,
                    total: totalMemoryTotal,
                    usagePct: memoryUsagePct,
                },
                disk: {
                    used: totalDiskUsed,
                    total: totalDiskTotal,
                    usagePct: diskUsagePct,
                },
            }
        });
    });
});

// Manual trigger for collector
app.post('/api/collect', async (req, res) => {
    try {
        console.log('Manual collection triggered via API');
        await runCollector();
        res.json({ message: 'Collection cycle triggered successfully' });
    } catch (err) {
        console.error('Manual collection failed:', err);
        res.status(500).json({ error: 'Collection failed: ' + err.message });
    }
});

// --- Webhook API Endpoints ---

// List all webhooks
app.get('/api/webhooks', (req, res) => {
    db.all('SELECT * FROM webhooks ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        // Mask URLs in response for security (show only last 8 chars)
        const safe = rows.map(r => ({
            ...r,
            events: (() => { try { return JSON.parse(r.events); } catch { return []; } })(),
        }));
        res.json({ data: safe });
    });
});

// Add webhook
app.post('/api/webhooks', (req, res) => {
    const { name, type, url, events } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
    const webhookType = type || 'generic';
    const eventsJson = JSON.stringify(events || []);

    db.run(
        'INSERT INTO webhooks (name, type, url, enabled, events) VALUES (?, ?, ?, 1, ?)',
        [name, webhookType, url, enabled, eventsJson],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to add webhook: ' + err.message });
            res.status(201).json({ data: { id: this.lastID, name, type: webhookType, url, enabled: 1, events: events || [] } });
        }
    );
});

// Update webhook
app.put('/api/webhooks/:id', (req, res) => {
    const { id } = req.params;
    const { name, type, url, enabled, events } = req.body;

    db.get('SELECT * FROM webhooks WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(404).json({ error: 'Webhook not found' });

        const updName = name ?? row.name;
        const updType = type ?? row.type;
        const updUrl = url ?? row.url;
        const updEnabled = enabled !== undefined ? (enabled ? 1 : 0) : row.enabled;
        const updEvents = events !== undefined ? JSON.stringify(events) : row.events;

        db.run(
            'UPDATE webhooks SET name = ?, type = ?, url = ?, enabled = ?, events = ? WHERE id = ?',
            [updName, updType, updUrl, updEnabled, updEvents, id],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to update webhook' });
                res.json({ data: { id: Number(id), name: updName, type: updType, url: updUrl, enabled: updEnabled, events: updEvents } });
            }
        );
    });
});

// Delete webhook
app.delete('/api/webhooks/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM webhooks WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete webhook' });
        if (this.changes === 0) return res.status(404).json({ error: 'Webhook not found' });
        res.json({ message: 'Webhook deleted', id });
    });
});

// Test webhook
app.post('/api/webhooks/:id/test', async (req, res) => {
    try {
        const result = await testWebhook(Number(req.params.id));
        res.json({ data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get alert history
app.get('/api/alerts/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    db.all('SELECT * FROM alert_history ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json({ data: rows });
    });
});

// Trigger alert checks manually
app.post('/api/alerts/check', async (req, res) => {
    try {
        const alerts = await runAlertChecks();
        res.json({ data: alerts, count: alerts.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Log Search Endpoint ---

// GET /api/logs/search — search and filter logs
app.get('/api/logs/search', (req, res) => {
    const keyword = req.query.keyword || '';
    const machineId = req.query.machine_id || null;
    const level = req.query.level || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 50;
    if (limit > 200) limit = 200;
    if (page < 1) page = 1;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (keyword) {
        conditions.push('l.message LIKE ?');
        params.push(`%${keyword}%`);
    }
    if (machineId) {
        conditions.push('l.machine_id = ?');
        params.push(machineId);
    }
    if (level) {
        conditions.push('l.level = ?');
        params.push(level);
    }
    if (dateFrom) {
        conditions.push('l.timestamp >= ?');
        params.push(dateFrom);
    }
    if (dateTo) {
        conditions.push('l.timestamp <= ?');
        params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM logs l ${whereClause}`;
    db.get(countSql, params, (err, countRow) => {
        if (err) {
            console.error('Error counting logs:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        const total = countRow.total;

        const dataSql = `
            SELECT l.*, m.name as machine_name, m.hostname as machine_hostname
            FROM logs l
            LEFT JOIN machines m ON l.machine_id = m.id
            ${whereClause}
            ORDER BY l.timestamp DESC
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, limit, offset];

        db.all(dataSql, dataParams, (err, rows) => {
            if (err) {
                console.error('Error searching logs:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json({
                data: rows,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                }
            });
        });
    });
});

// GET /api/logs/levels — distinct log levels
app.get('/api/logs/levels', (req, res) => {
    db.all('SELECT DISTINCT level FROM logs WHERE level IS NOT NULL ORDER BY level', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json({ data: rows.map(r => r.level) });
    });
});

// --- Proxmox API Endpoints ---

// List proxmox hosts
app.get('/api/proxmox/hosts', (req, res) => {
    db.all('SELECT * FROM proxmox_hosts ORDER BY name', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        // Mask token secrets
        const safe = rows.map(r => ({ ...r, token_secret: r.token_secret ? '***' : null }));
        res.json({ data: safe });
    });
});

// Add proxmox host (with automatic SSH machine linkage)
app.post('/api/proxmox/hosts', (req, res) => {
    const { name, api_url, node_name, token_id, token_secret, verify_ssl } = req.body;
    if (!name || !api_url) return res.status(400).json({ error: 'Name and API URL are required' });

    let apiHostname;
    try {
        apiHostname = new URL(api_url).hostname;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid API URL' });
    }

    // Auto-link or auto-create matching machine entry
    db.get('SELECT id FROM machines WHERE hostname = ?', [apiHostname], (err, machine) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const proceedWithInsert = (machineId) => {
            db.run(
                `INSERT INTO proxmox_hosts (name, api_url, node_name, token_id, token_secret, verify_ssl, ssh_machine_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, api_url, node_name || 'pve', token_id || null, token_secret || null, verify_ssl ? 1 : 0, machineId],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to add host: ' + err.message });
                    res.status(201).json({
                        data: {
                            id: this.lastID,
                            name,
                            api_url,
                            node_name: node_name || 'pve',
                            ssh_machine_id: machineId
                        }
                    });
                }
            );
        };

        if (machine) {
            // Found existing machine
            proceedWithInsert(machine.id);
        } else {
            // Auto-create machine entry (assume root user by default)
            db.run(
                `INSERT INTO machines (name, hostname, user, status) VALUES (?, ?, ?, 'unknown')`,
                [name, apiHostname, 'root'],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to auto-create machine: ' + err.message });
                    proceedWithInsert(this.lastID);
                }
            );
        }
    });
});

// Update proxmox host
app.put('/api/proxmox/hosts/:id', (req, res) => {
    const { id } = req.params;
    const { name, api_url, node_name, token_id, token_secret, verify_ssl, ssh_machine_id, enabled } = req.body;

    db.get('SELECT * FROM proxmox_hosts WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!row) return res.status(404).json({ error: 'Host not found' });

        db.run(
            `UPDATE proxmox_hosts SET name = ?, api_url = ?, node_name = ?, token_id = ?, token_secret = ?, verify_ssl = ?, ssh_machine_id = ?, enabled = ? WHERE id = ?`,
            [
                name ?? row.name, api_url ?? row.api_url, node_name ?? row.node_name,
                token_id ?? row.token_id, token_secret === '***' ? row.token_secret : (token_secret ?? row.token_secret),
                verify_ssl !== undefined ? (verify_ssl ? 1 : 0) : row.verify_ssl,
                ssh_machine_id ?? row.ssh_machine_id,
                enabled !== undefined ? (enabled ? 1 : 0) : row.enabled,
                id,
            ],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to update host' });
                res.json({ message: 'Host updated', id: Number(id) });
            }
        );
    });
});

// Delete proxmox host
app.delete('/api/proxmox/hosts/:id', (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run('DELETE FROM proxmox_metrics WHERE proxmox_host_id = ?', [id]);
        db.run('DELETE FROM proxmox_resources WHERE proxmox_host_id = ?', [id]);
        db.run('DELETE FROM proxmox_hosts WHERE id = ?', [id], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to delete host' });
            if (this.changes === 0) return res.status(404).json({ error: 'Host not found' });
            res.json({ message: 'Host deleted', id });
        });
    });
});

// Get all proxmox resources (optionally filtered by host)
app.get('/api/proxmox/resources', (req, res) => {
    const hostId = req.query.hostId;
    let sql = `SELECT r.*, h.name as host_name FROM proxmox_resources r JOIN proxmox_hosts h ON r.proxmox_host_id = h.id`;
    const params = [];
    if (hostId) {
        sql += ' WHERE r.proxmox_host_id = ?';
        params.push(hostId);
    }
    sql += ' ORDER BY r.type, r.vmid';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json({ data: rows });
    });
});

// Get metrics history for a specific proxmox resource
app.get('/api/proxmox/metrics/:hostId/:vmid', (req, res) => {
    const { hostId, vmid } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    db.all(
        `SELECT * FROM proxmox_metrics WHERE proxmox_host_id = ? AND vmid = ? ORDER BY timestamp DESC LIMIT ?`,
        [hostId, vmid, limit],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Internal server error' });
            res.json({ data: rows });
        }
    );
});

// Trigger proxmox collection manually
app.post('/api/proxmox/collect', async (req, res) => {
    try {
        await runProxmoxCollector();
        res.json({ message: 'Proxmox collection complete' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Sudo-powered Host Controls ---
const { getKeyForHost } = require('./backend/ssh_utils');
const ssh2Controls = require('ssh2');

// Allowed sudo commands (whitelist for safety)
const ALLOWED_ACTIONS = {
    reboot:          { command: 'sudo /sbin/reboot' },
    'check-updates': { command: 'sudo apt list --upgradable 2>/dev/null || sudo yum check-update 2>/dev/null || echo "Unknown package manager"' },
    update:          { command: 'sudo apt-get update 2>/dev/null || sudo yum makecache -y 2>/dev/null || sudo yum check-update 2>/dev/null || echo "Unknown package manager"' },
    upgrade:         { command: 'sudo apt-get upgrade -y 2>/dev/null || sudo yum update -y 2>/dev/null || echo "Unknown package manager"' },
    'upgrade-all':   { command: 'sudo apt-get update && sudo apt-get upgrade -y' },
    'restart-docker':{ command: 'sudo systemctl restart docker' },
    'restart-ssh':   { command: 'sudo systemctl restart sshd' },
    'service-status':{ command: 'sudo systemctl list-units --type=service --state=running --no-pager --no-legend' },
};

const STREAMING_ACTIONS = new Set(['check-updates', 'update', 'upgrade', 'upgrade-all', 'service-status']);

function sshExecOnMachine(machine, command, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const conn = new ssh2Controls.Client();
        const timer = setTimeout(() => {
            conn.end();
            reject(new Error('SSH command timed out'));
        }, timeoutMs);

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) { clearTimeout(timer); conn.end(); return reject(err); }
                let stdout = '', stderr = '';
                stream.on('data', d => stdout += d.toString());
                stream.stderr.on('data', d => stderr += d.toString());
                stream.on('close', (code) => {
                    clearTimeout(timer);
                    conn.end();
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
                });
            });
        });
        conn.on('error', err => { clearTimeout(timer); reject(err); });

        const key = getKeyForHost(machine.hostname);
        conn.connect({
            host: machine.hostname,
            port: machine.ssh_port || 22,
            username: machine.ssh_user || 'root',
            privateKey: key,
            readyTimeout: 10000,
        });
    });
}

// POST /api/machines/:id/control  { action: "reboot" | "check-updates" | ... }
app.post('/api/machines/:id/control', async (req, res) => {
    const { action } = req.body || {};
    if (!action || !ALLOWED_ACTIONS[action]) {
        return res.status(400).json({ error: `Invalid action. Allowed: ${Object.keys(ALLOWED_ACTIONS).join(', ')}` });
    }

    if (STREAMING_ACTIONS.has(action)) {
        return res.status(409).json({ error: `Action '${action}' must be run via the WebSocket stream.` });
    }

    const machineId = req.params.id;
    db.get('SELECT * FROM machines WHERE id = ?', [machineId], async (err, machine) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        try {
            const result = await sshExecOnMachine(machine, ALLOWED_ACTIONS[action].command);
            res.json({
                machine: machine.name,
                action,
                exitCode: result.code,
                stdout: result.stdout,
                stderr: result.stderr,
            });
        } catch (e) {
            res.status(500).json({ error: `Failed to execute '${action}' on ${machine.name}: ${e.message}` });
        }
    });
});

// POST /api/machines/batch/control { action: "reboot" | "update" | ..., machineIds: [1,2,3] }
app.post('/api/machines/batch/control', async (req, res) => {
    const { action, machineIds } = req.body || {};
    if (!action || !ALLOWED_ACTIONS[action]) {
        return res.status(400).json({ error: `Invalid action. Allowed: ${Object.keys(ALLOWED_ACTIONS).join(', ')}` });
    }
    if (!Array.isArray(machineIds) || machineIds.length === 0) {
        return res.status(400).json({ error: 'machineIds must be a non-empty array' });
    }

    const ids = [...new Set(machineIds.map(id => Number(id)).filter(n => Number.isFinite(n)))];
    if (ids.length === 0) {
        return res.status(400).json({ error: 'machineIds must contain valid numeric IDs' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT * FROM machines WHERE id IN (${placeholders})`, ids, async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const foundIds = new Set(rows.map(r => r.id));
        const missingIds = ids.filter(id => !foundIds.has(id));
        const timeoutMs = STREAMING_ACTIONS.has(action) ? 10 * 60 * 1000 : 20000;

        const results = await Promise.all(rows.map(async (machine) => {
            if (machine.status === 'offline') {
                return { machineId: machine.id, machineName: machine.name, ok: false, error: 'Machine offline' };
            }
            try {
                const result = await sshExecOnMachine(machine, ALLOWED_ACTIONS[action].command, timeoutMs);
                return {
                    machineId: machine.id,
                    machineName: machine.name,
                    ok: result.code === 0,
                    exitCode: result.code,
                    stdout: result.stdout,
                    stderr: result.stderr,
                };
            } catch (e) {
                return { machineId: machine.id, machineName: machine.name, ok: false, error: e.message };
            }
        }));

        res.json({ action, results, missingIds });
    });
});

// GET /api/machines/:id/controls  — list available actions
app.get('/api/machines/:id/controls', (req, res) => {
    res.json({ actions: Object.keys(ALLOWED_ACTIONS) });
});

// --- Server Startup & Scheduler ---

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Attach WebSocket terminal proxy
    attachTerminalProxy(server, db);
    
    // Start the collector loop
    // Only start if not in test mode or if explicitly enabled
    if (process.env.NODE_ENV !== 'test') {
        console.log(`Scheduling collector to run every ${COLLECTOR_INTERVAL_MS}ms`);
        setInterval(() => {
            runCollector();
        }, COLLECTOR_INTERVAL_MS);
        
        // Run once on startup
        runCollector();
        runProxmoxCollector();

        // Run Proxmox collector every 60s
        console.log('Scheduling Proxmox collector every 60s');
        setInterval(() => {
            runProxmoxCollector();
        }, COLLECTOR_INTERVAL_MS);

        // Run alert checks every 60s (after collection)
        console.log('Scheduling alert checks every 60s');
        setInterval(() => {
            runAlertChecks();
        }, COLLECTOR_INTERVAL_MS);
    }
});
